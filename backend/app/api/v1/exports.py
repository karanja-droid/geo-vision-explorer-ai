"""Export endpoints for role-based reports and data exports."""

from typing import Dict, Any, Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models.core import User, ExportJob
from ...services.export_service import ExportService
from ...core.permissions import check_permission

router = APIRouter(prefix="/exports", tags=["exports"])

class ExportRequest(BaseModel):
    module: str
    report_type: str
    format: str
    project_id: Optional[UUID] = None
    parameters: Optional[Dict[str, Any]] = None

class ExportResponse(BaseModel):
    job_id: str
    status: str
    message: str

class ExportJobResponse(BaseModel):
    job_id: str
    status: str
    module: str
    report_type: str
    format: str
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

@router.post("/", response_model=ExportResponse)
async def create_export(
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new export job."""
    
    # Validate module and format
    valid_modules = [
        'executive', 'investor', 'geologist', 'geophysicist', 
        'geochemist', 'driller', 'surveyor', 'planner'
    ]
    
    if request.module not in valid_modules:
        raise HTTPException(status_code=400, detail=f"Invalid module: {request.module}")
    
    valid_formats = ['csv', 'xlsx', 'pdf', 'geojson', 'gpkg', 'cog', 'glb', 'png']
    if request.format not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format: {request.format}")
    
    # Check permissions
    permission_key = f"export_{request.module}_{request.report_type}"
    if not await check_permission(db, current_user.id, permission_key):
        raise HTTPException(status_code=403, detail="Insufficient permissions for this export")
    
    # Create export job
    export_service = ExportService()
    job_id = await export_service.create_export_job(
        db=db,
        user_id=current_user.id,
        org_id=current_user.org_id,
        project_id=request.project_id,
        module=request.module,
        report_type=request.report_type,
        format=request.format,
        parameters=request.parameters
    )
    
    return ExportResponse(
        job_id=job_id,
        status="pending",
        message="Export job created successfully"
    )

@router.get("/{job_id}", response_model=ExportJobResponse)
async def get_export_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get export job status and results."""
    
    export_service = ExportService()
    job = await export_service.get_export_job(db, job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    # Check if user owns this job
    if job.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate fresh signed URL if completed
    file_url = None
    if job.status == 'completed' and job.file_url:
        # Extract S3 key from existing URL or use stored key
        s3_key = f"exports/{job.org_id}/{job_id}/"
        file_url = export_service.generate_signed_url(s3_key)
    
    return ExportJobResponse(
        job_id=job.job_id,
        status=job.status,
        module=job.module,
        report_type=job.report_type,
        format=job.format,
        file_url=file_url,
        file_size=job.file_size,
        mime_type=job.mime_type,
        error_message=job.error_message,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )

@router.get("/", response_model=List[ExportJobResponse])
async def list_export_jobs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List export jobs for current user."""
    
    export_service = ExportService()
    jobs = await export_service.list_export_jobs(
        db=db,
        user_id=current_user.id,
        org_id=current_user.org_id,
        limit=limit
    )
    
    return [
        ExportJobResponse(
            job_id=job.job_id,
            status=job.status,
            module=job.module,
            report_type=job.report_type,
            format=job.format,
            file_url=None,  # Don't include URLs in list view
            file_size=job.file_size,
            mime_type=job.mime_type,
            error_message=job.error_message,
            created_at=job.created_at.isoformat(),
            completed_at=job.completed_at.isoformat() if job.completed_at else None
        )
        for job in jobs
    ]

# Role-specific export endpoints
@router.post("/executive/{report_type}")
async def export_executive_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export executive reports (KPI dashboard, pipeline status, ESG summary)."""
    
    valid_reports = ['kpi_dashboard', 'pipeline_status', 'esg_summary']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid executive report type: {report_type}")
    
    export_request = ExportRequest(
        module='executive',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/geologist/{report_type}")
async def export_geologist_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export geologist reports (mapbook, target rationale, campaign summary)."""
    
    valid_reports = ['geological_mapbook', 'target_rationale', 'campaign_summary']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid geologist report type: {report_type}")
    
    export_request = ExportRequest(
        module='geologist',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/driller/{report_type}")
async def export_driller_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export driller reports (progress vs plan, deviation analysis, cost analysis)."""
    
    valid_reports = ['progress_vs_plan', 'deviation_analysis', 'cost_analysis', 'drill_summary']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid driller report type: {report_type}")
    
    export_request = ExportRequest(
        module='driller',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/geochemist/{report_type}")
async def export_geochemist_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export geochemist reports (QA/QC, anomaly analysis, lab performance)."""
    
    valid_reports = ['qaqc_report', 'anomaly_analysis', 'lab_performance']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid geochemist report type: {report_type}")
    
    export_request = ExportRequest(
        module='geochemist',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/geophysicist/{report_type}")
async def export_geophysicist_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export geophysicist reports (anomaly maps, processing chain, profile packs)."""
    
    valid_reports = ['anomaly_maps', 'processing_chain', 'profile_packs']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid geophysicist report type: {report_type}")
    
    export_request = ExportRequest(
        module='geophysicist',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/surveyor/{report_type}")
async def export_surveyor_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export surveyor reports (survey adjustment, collar certificate, DTM change)."""
    
    valid_reports = ['survey_adjustment', 'collar_certificate', 'dtm_change', 'flight_log']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid surveyor report type: {report_type}")
    
    export_request = ExportRequest(
        module='surveyor',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)

@router.post("/planner/{report_type}")
async def export_planner_report(
    report_type: str,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export planner reports (scenario comparison, schedule, resource case)."""
    
    valid_reports = ['scenario_comparison', 'schedule_gantt', 'resource_case', 'capex_opex']
    if report_type not in valid_reports:
        raise HTTPException(status_code=400, detail=f"Invalid planner report type: {report_type}")
    
    export_request = ExportRequest(
        module='planner',
        report_type=report_type,
        format=request.get('format', 'pdf'),
        project_id=request.get('project_id'),
        parameters=request.get('parameters', {})
    )
    
    return await create_export(export_request, db, current_user)