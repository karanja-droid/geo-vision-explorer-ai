"""Drill Data API Endpoints

FastAPI endpoints for drill hole data management including upload,
QA validation, and report generation.
"""

from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel, Field
import pandas as pd
import io
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.services.drill_qa import DrillQAService
from app.tasks.drill_qa import run_drill_qa_validation, generate_qa_report
from app.models.drill_data import DrillCollar, QAResult, QAReport
from app.core.config import settings

router = APIRouter()


class DrillDataUpload(BaseModel):
    """Request model for drill data upload"""
    data_type: str = Field(..., description="Type of data: collar, survey, interval, assay")
    file_format: str = Field(..., description="File format: csv, xlsx")
    project_id: Optional[UUID] = Field(None, description="Project ID")


class QAValidationRequest(BaseModel):
    """Request model for QA validation"""
    project_id: Optional[UUID] = Field(None, description="Project ID filter")
    hole_ids: Optional[List[str]] = Field(None, description="Specific hole IDs to validate")


class QAReportRequest(BaseModel):
    """Request model for QA report generation"""
    project_id: Optional[UUID] = Field(None, description="Project ID filter")
    report_type: str = Field(default="on_demand", description="Report type")


class QAResultResponse(BaseModel):
    """Response model for QA results"""
    id: str
    hole_id: str
    severity: str
    message: str
    status: str
    created_at: str
    rule_name: Optional[str]
    details: Optional[Dict[str, Any]]


class QAReportResponse(BaseModel):
    """Response model for QA reports"""
    id: str
    report_name: str
    report_type: str
    status: str
    total_holes: int
    total_issues: int
    error_count: int
    warning_count: int
    created_at: str
    completed_at: Optional[str]
    report_path: Optional[str]


@router.post("/upload")
async def upload_drill_data(
    file: UploadFile = File(...),
    data_type: str = Field(..., description="collar, survey, interval, or assay"),
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Upload drill hole data from CSV/Excel files
    
    Supports uploading collar, survey, interval, and assay data
    with automatic validation and QA checking.
    """
    try:
        if not settings.ENABLE_DRILL_QA:
            raise HTTPException(status_code=503, detail="Drill QA service is disabled")
        
        # Validate data type
        valid_types = ['collar', 'survey', 'interval', 'assay']
        if data_type not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid data_type. Must be one of: {valid_types}"
            )
        
        # Read file content
        content = await file.read()
        
        # Determine file format
        file_format = 'csv'
        if file.filename and file.filename.endswith('.xlsx'):
            file_format = 'xlsx'
        
        # Parse file content
        try:
            if file_format == 'csv':
                df = pd.read_csv(io.BytesIO(content))
            else:
                df = pd.read_excel(io.BytesIO(content))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to parse {file_format} file: {str(e)}"
            )
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
        # Get user context
        org_id = current_user.get('org_id')
        user_id = current_user.get('user_id')
        
        # Process data based on type
        processed_count = await _process_drill_data(
            db, df, data_type, org_id, project_id, user_id
        )
        
        # Start QA validation in background
        validation_task = run_drill_qa_validation.delay(
            org_id=str(org_id),
            project_id=project_id,
            user_id=str(user_id)
        )
        
        return {
            'status': 'success',
            'message': f'Uploaded {processed_count} {data_type} records',
            'data_type': data_type,
            'records_processed': processed_count,
            'validation_task_id': validation_task.id,
            'file_info': {
                'filename': file.filename,
                'size_bytes': len(content),
                'format': file_format,
                'columns': list(df.columns)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/qa/validate")
async def start_qa_validation(
    request: QAValidationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Start QA validation for drill hole data"""
    try:
        if not settings.ENABLE_DRILL_QA:
            raise HTTPException(status_code=503, detail="Drill QA service is disabled")
        
        # Get user context
        org_id = current_user.get('org_id')
        user_id = current_user.get('user_id')
        
        # Start validation task
        task = run_drill_qa_validation.delay(
            org_id=str(org_id),
            project_id=str(request.project_id) if request.project_id else None,
            hole_ids=request.hole_ids,
            user_id=str(user_id)
        )
        
        return {
            'task_id': task.id,
            'status': 'started',
            'message': 'QA validation started',
            'estimated_completion_minutes': 5
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start QA validation: {str(e)}")


@router.get("/qa/validate/status/{task_id}")
async def get_validation_status(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get status of QA validation task"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            response = {
                'task_id': task_id,
                'status': 'pending',
                'message': 'Validation task is waiting to be processed'
            }
        elif task.state == 'PROGRESS':
            response = {
                'task_id': task_id,
                'status': 'running',
                'message': 'QA validation is in progress',
                'progress': task.info
            }
        elif task.state == 'SUCCESS':
            response = {
                'task_id': task_id,
                'status': 'completed',
                'message': 'QA validation completed successfully',
                'result': task.result
            }
        else:  # FAILURE
            response = {
                'task_id': task_id,
                'status': 'failed',
                'message': 'QA validation failed',
                'error': str(task.info)
            }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get validation status: {str(e)}")


@router.get("/qa/results", response_model=List[QAResultResponse])
async def get_qa_results(
    project_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get QA results with optional filtering"""
    try:
        service = DrillQAService(db)
        
        # Get user context
        org_id = UUID(current_user['org_id'])
        
        # Get QA results
        results = await service.get_qa_results(
            org_id=org_id,
            project_id=project_id,
            severity=severity,
            status=status,
            limit=limit
        )
        
        # Convert to response format
        response_results = []
        for result in results:
            response_results.append(QAResultResponse(
                id=str(result.id),
                hole_id=result.hole_id,
                severity=result.severity,
                message=result.message,
                status=result.status,
                created_at=result.created_at.isoformat(),
                rule_name=result.rule.rule_name if result.rule else None,
                details=result.details
            ))
        
        return response_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get QA results: {str(e)}")


@router.put("/qa/results/{result_id}/resolve")
async def resolve_qa_issue(
    result_id: UUID,
    resolution_note: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Mark a QA issue as resolved"""
    try:
        service = DrillQAService(db)
        user_id = UUID(current_user['user_id'])
        
        result = await service.resolve_qa_issue(
            result_id=result_id,
            user_id=user_id,
            resolution_note=resolution_note
        )
        
        return {
            'id': str(result.id),
            'status': result.status,
            'resolved_at': result.resolved_at.isoformat() if result.resolved_at else None,
            'resolved_by': str(result.resolved_by) if result.resolved_by else None,
            'message': 'QA issue resolved successfully'
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resolve QA issue: {str(e)}")


@router.post("/qa/reports/generate")
async def generate_qa_report_endpoint(
    request: QAReportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Generate QA report"""
    try:
        if not settings.ENABLE_DRILL_QA:
            raise HTTPException(status_code=503, detail="Drill QA service is disabled")
        
        # Get user context
        org_id = current_user.get('org_id')
        user_id = current_user.get('user_id')
        
        # Start report generation task
        task = generate_qa_report.delay(
            org_id=str(org_id),
            project_id=str(request.project_id) if request.project_id else None,
            report_type=request.report_type,
            user_id=str(user_id)
        )
        
        return {
            'task_id': task.id,
            'status': 'started',
            'message': 'QA report generation started',
            'report_type': request.report_type,
            'estimated_completion_minutes': 10
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start report generation: {str(e)}")


@router.get("/qa/reports/status/{task_id}")
async def get_report_generation_status(
    task_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get status of QA report generation task"""
    try:
        from app.core.celery_app import celery_app
        
        task = celery_app.AsyncResult(task_id)
        
        if task.state == 'PENDING':
            response = {
                'task_id': task_id,
                'status': 'pending',
                'message': 'Report generation task is waiting to be processed'
            }
        elif task.state == 'PROGRESS':
            response = {
                'task_id': task_id,
                'status': 'running',
                'message': 'QA report generation is in progress',
                'progress': task.info
            }
        elif task.state == 'SUCCESS':
            response = {
                'task_id': task_id,
                'status': 'completed',
                'message': 'QA report generation completed successfully',
                'result': task.result
            }
        else:  # FAILURE
            response = {
                'task_id': task_id,
                'status': 'failed',
                'message': 'QA report generation failed',
                'error': str(task.info)
            }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get report status: {str(e)}")


@router.get("/qa/reports", response_model=List[QAReportResponse])
async def get_qa_reports(
    project_id: Optional[UUID] = None,
    report_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get list of QA reports"""
    try:
        # Get user context
        org_id = UUID(current_user['org_id'])
        
        # Build query
        query = db.query(QAReport).filter(QAReport.org_id == org_id)
        
        if project_id:
            query = query.filter(QAReport.project_id == project_id)
        if report_type:
            query = query.filter(QAReport.report_type == report_type)
        
        reports = query.order_by(QAReport.created_at.desc()).limit(limit).all()
        
        # Convert to response format
        response_reports = []
        for report in reports:
            response_reports.append(QAReportResponse(
                id=str(report.id),
                report_name=report.report_name,
                report_type=report.report_type,
                status=report.status,
                total_holes=report.total_holes,
                total_issues=report.total_issues,
                error_count=report.error_count,
                warning_count=report.warning_count,
                created_at=report.created_at.isoformat(),
                completed_at=report.completed_at.isoformat() if report.completed_at else None,
                report_path=report.report_path
            ))
        
        return response_reports
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get QA reports: {str(e)}")


@router.get("/qa/reports/{report_id}/download")
async def download_qa_report(
    report_id: UUID,
    format: str = "html",
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Download QA report in HTML or PDF format"""
    try:
        # Get user context
        org_id = UUID(current_user['org_id'])
        
        # Get report
        report = db.query(QAReport).filter(
            and_(QAReport.id == report_id, QAReport.org_id == org_id)
        ).first()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        if report.status != 'completed':
            raise HTTPException(status_code=400, detail="Report is not completed yet")
        
        # For now, return a placeholder response
        # In production, this would download from S3
        content = f"QA Report: {report.report_name}\nStatus: {report.status}\nTotal Issues: {report.total_issues}"
        
        media_type = "text/html" if format == "html" else "application/pdf"
        filename = f"{report.report_name}.{format}"
        
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download report: {str(e)}")


@router.get("/holes")
async def get_drill_holes(
    project_id: Optional[UUID] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """Get list of drill holes with basic information"""
    try:
        # Get user context
        org_id = UUID(current_user['org_id'])
        
        # Build query
        query = db.query(DrillCollar).filter(DrillCollar.org_id == org_id)
        
        if project_id:
            query = query.filter(DrillCollar.project_id == project_id)
        
        holes = query.order_by(DrillCollar.hole_id).limit(limit).all()
        
        # Convert to response format
        response_holes = []
        for hole in holes:
            # Extract coordinates
            lon = db.scalar(func.ST_X(hole.geom))
            lat = db.scalar(func.ST_Y(hole.geom))
            
            response_holes.append({
                'hole_id': hole.hole_id,
                'longitude': lon,
                'latitude': lat,
                'elevation': hole.elevation,
                'total_depth': hole.total_depth,
                'start_date': hole.start_date.isoformat() if hole.start_date else None,
                'drill_type': hole.drill_type,
                'contractor': hole.contractor,
                'project': hole.project
            })
        
        return {
            'holes': response_holes,
            'total_count': len(response_holes)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get drill holes: {str(e)}")


async def _process_drill_data(
    db: Session, 
    df: pd.DataFrame, 
    data_type: str, 
    org_id: str, 
    project_id: Optional[str], 
    user_id: str
) -> int:
    """Process uploaded drill data and insert into database"""
    
    # This is a simplified implementation
    # In production, this would include comprehensive data validation and transformation
    
    processed_count = 0
    
    if data_type == 'collar':
        # Process collar data
        required_cols = ['hole_id', 'longitude', 'latitude']
        missing_cols = [col for col in required_cols if col not in df.columns]
        
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        for _, row in df.iterrows():
            # Create collar record (simplified)
            collar = DrillCollar(
                hole_id=str(row['hole_id']),
                geom=f"POINT({row['longitude']} {row['latitude']})",
                elevation=row.get('elevation'),
                total_depth=row.get('total_depth'),
                start_date=pd.to_datetime(row['start_date']).date() if 'start_date' in row and pd.notna(row['start_date']) else None,
                drill_type=row.get('drill_type'),
                contractor=row.get('contractor'),
                project=row.get('project'),
                org_id=UUID(org_id),
                project_id=UUID(project_id) if project_id else None
            )
            
            # Check for existing hole
            existing = db.query(DrillCollar).filter(
                and_(
                    DrillCollar.hole_id == collar.hole_id,
                    DrillCollar.org_id == UUID(org_id)
                )
            ).first()
            
            if not existing:
                db.add(collar)
                processed_count += 1
    
    # Add similar processing for other data types (survey, interval, assay)
    # This is simplified for the example
    
    db.commit()
    return processed_count


# Health check endpoint
@router.get("/health")
async def drill_data_health():
    """Health check for drill data service"""
    if not settings.ENABLE_DRILL_QA:
        raise HTTPException(status_code=503, detail="Drill QA service is disabled")
    
    return {
        "status": "healthy",
        "service": "drill_data",
        "version": "1.0.0",
        "features": {
            "data_upload": True,
            "qa_validation": True,
            "report_generation": True,
            "automated_qa": True
        }
    }