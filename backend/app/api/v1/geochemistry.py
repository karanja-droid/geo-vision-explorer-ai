"""Geochemistry and LIMS API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
import pandas as pd
import io
import numpy as np

from app.database import get_db
from app.models.drilling import GeochemSample, GeochemResult, COCBatch, QCRule, QCResult
from app.schemas.drilling import (
    GeochemSample as GeochemSampleSchema,
    GeochemSampleCreate,
    GeochemSampleUpdate,
    GeochemResult as GeochemResultSchema,
    GeochemResultCreate,
    GeochemResultUpdate,
    COCBatch as COCBatchSchema,
    COCBatchCreate,
    COCBatchUpdate,
    QCRule as QCRuleSchema,
    QCRuleCreate,
    QCRuleUpdate,
    QCResult as QCResultSchema,
    GeochemImport
)
from app.schemas.core import SuccessResponse
from app.services.validation import validate_geometry, validate_element_code, validate_units
from app.services.exports import create_export_job
from app.services.stac import register_geochemistry_data
from app.services.qc_engine import run_qc_analysis, calculate_z_scores
from app.core.security import get_current_user

router = APIRouter()

# Geochemistry Sample endpoints
@router.post("/samples", response_model=GeochemSampleSchema, status_code=status.HTTP_201_CREATED)
async def create_geochem_sample(
    sample_data: GeochemSampleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new geochemistry sample"""
    
    # Check if sample_id already exists in project
    existing_sample = db.query(GeochemSample).filter(
        GeochemSample.org_id == sample_data.org_id,
        GeochemSample.project_id == sample_data.project_id,
        GeochemSample.sample_id == sample_data.sample_id
    ).first()
    
    if existing_sample:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sample '{sample_data.sample_id}' already exists in this project"
        )
    
    # Validate coordinates
    if not (-180 <= sample_data.easting <= 180 and -90 <= sample_data.northing <= 90):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid coordinates. Easting must be -180 to 180, Northing must be -90 to 90"
        )
    
    # Create sample with PostGIS point geometry
    sample_dict = sample_data.dict()
    sample = GeochemSample(**sample_dict)
    sample.geom = f"SRID=4326;POINT({sample_data.easting} {sample_data.northing})"
    
    db.add(sample)
    db.commit()
    db.refresh(sample)
    
    # Register in STAC
    try:
        await register_geochemistry_data(db, sample)
    except Exception as e:
        print(f"Failed to register geochemistry data in STAC: {e}")
    
    return sample

@router.get("/samples", response_model=List[GeochemSampleSchema])
async def list_geochem_samples(
    project_id: Optional[UUID] = Query(None),
    sample_type: Optional[str] = Query(None),
    country_code: Optional[str] = Query(None, max_length=2),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List geochemistry samples with optional filtering"""
    
    query = db.query(GeochemSample)
    
    if project_id:
        query = query.filter(GeochemSample.project_id == project_id)
    
    if sample_type:
        query = query.filter(GeochemSample.sample_type == sample_type)
    
    if country_code:
        query = query.filter(GeochemSample.country_code == country_code.upper())
    
    samples = query.offset(skip).limit(limit).all()
    return samples

@router.get("/samples/{sample_id}", response_model=GeochemSampleSchema)
async def get_geochem_sample(
    sample_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get geochemistry sample by ID"""
    
    sample = db.query(GeochemSample).filter(GeochemSample.id == sample_id).first()
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geochemistry sample not found"
        )
    
    return sample

@router.put("/samples/{sample_id}", response_model=GeochemSampleSchema)
async def update_geochem_sample(
    sample_id: UUID,
    sample_data: GeochemSampleUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update geochemistry sample"""
    
    sample = db.query(GeochemSample).filter(GeochemSample.id == sample_id).first()
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geochemistry sample not found"
        )
    
    # Update fields
    update_data = sample_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sample, field, value)
    
    # Update geometry if coordinates changed
    if 'easting' in update_data or 'northing' in update_data:
        sample.geom = f"SRID=4326;POINT({sample.easting} {sample.northing})"
    
    db.commit()
    db.refresh(sample)
    
    return sample

@router.delete("/samples/{sample_id}", response_model=SuccessResponse)
async def delete_geochem_sample(
    sample_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete geochemistry sample and all associated results"""
    
    sample = db.query(GeochemSample).filter(GeochemSample.id == sample_id).first()
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geochemistry sample not found"
        )
    
    # Delete associated results (cascade)
    db.delete(sample)
    db.commit()
    
    return SuccessResponse(message="Geochemistry sample deleted successfully")

# Geochemistry Result endpoints
@router.post("/results", response_model=GeochemResultSchema, status_code=status.HTTP_201_CREATED)
async def create_geochem_result(
    result_data: GeochemResultCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new geochemistry result"""
    
    # Verify sample exists
    sample = db.query(GeochemSample).filter(GeochemSample.id == result_data.sample_id).first()
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Geochemistry sample not found"
        )
    
    # Validate elements
    for element, result in result_data.elements.items():
        if not validate_element_code(element):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid element code: {element}"
            )
        
        if result.value is not None and not validate_units(result.value, result.unit, element):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid value/unit combination for {element}: {result.value} {result.unit}"
            )
    
    result = GeochemResult(**result_data.dict())
    db.add(result)
    db.commit()
    db.refresh(result)
    
    return result

@router.get("/results", response_model=List[GeochemResultSchema])
async def list_geochem_results(
    sample_id: Optional[UUID] = Query(None),
    batch_id: Optional[str] = Query(None),
    element: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List geochemistry results"""
    
    query = db.query(GeochemResult)
    
    if sample_id:
        query = query.filter(GeochemResult.sample_id == sample_id)
    
    if batch_id:
        query = query.filter(GeochemResult.batch_id == batch_id)
    
    if element:
        query = query.filter(GeochemResult.elements.has_key(element))
    
    results = query.all()
    return results

# Chain of Custody endpoints
@router.post("/coc-batches", response_model=COCBatchSchema, status_code=status.HTTP_201_CREATED)
async def create_coc_batch(
    batch_data: COCBatchCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new chain of custody batch"""
    
    # Check if batch_id already exists in project
    existing_batch = db.query(COCBatch).filter(
        COCBatch.org_id == batch_data.org_id,
        COCBatch.project_id == batch_data.project_id,
        COCBatch.batch_id == batch_data.batch_id
    ).first()
    
    if existing_batch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch '{batch_data.batch_id}' already exists in this project"
        )
    
    batch = COCBatch(**batch_data.dict())
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    return batch

@router.get("/coc-batches", response_model=List[COCBatchSchema])
async def list_coc_batches(
    project_id: Optional[UUID] = Query(None),
    lab: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List chain of custody batches"""
    
    query = db.query(COCBatch)
    
    if project_id:
        query = query.filter(COCBatch.project_id == project_id)
    
    if lab:
        query = query.filter(COCBatch.lab == lab)
    
    if status_filter:
        query = query.filter(COCBatch.status == status_filter)
    
    batches = query.order_by(COCBatch.submitted_date.desc()).all()
    return batches

@router.put("/coc-batches/{batch_id}", response_model=COCBatchSchema)
async def update_coc_batch(
    batch_id: UUID,
    batch_data: COCBatchUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update chain of custody batch"""
    
    batch = db.query(COCBatch).filter(COCBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chain of custody batch not found"
        )
    
    # Update fields
    update_data = batch_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(batch, field, value)
    
    db.commit()
    db.refresh(batch)
    
    return batch

# QC Rules endpoints
@router.post("/qc-rules", response_model=QCRuleSchema, status_code=status.HTTP_201_CREATED)
async def create_qc_rule(
    rule_data: QCRuleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new QC rule"""
    
    # Validate element code
    if not validate_element_code(rule_data.element):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid element code: {rule_data.element}"
        )
    
    rule = QCRule(**rule_data.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return rule

@router.get("/qc-rules", response_model=List[QCRuleSchema])
async def list_qc_rules(
    project_id: Optional[UUID] = Query(None),
    element: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List QC rules"""
    
    query = db.query(QCRule)
    
    if project_id:
        query = query.filter(QCRule.project_id == project_id)
    
    if element:
        query = query.filter(QCRule.element == element)
    
    if active_only:
        query = query.filter(QCRule.active == True)
    
    rules = query.all()
    return rules

# QC Analysis endpoints
@router.post("/qc-analysis/{batch_id}")
async def run_batch_qc_analysis(
    batch_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Run QC analysis for a batch"""
    
    batch = db.query(COCBatch).filter(COCBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chain of custody batch not found"
        )
    
    # Run QC analysis
    qc_results = await run_qc_analysis(db, batch_id)
    
    return {
        "batch_id": batch_id,
        "qc_results": qc_results,
        "summary": {
            "total_checks": len(qc_results),
            "passed": len([r for r in qc_results if r.flag == "pass"]),
            "warnings": len([r for r in qc_results if r.flag == "warning"]),
            "failures": len([r for r in qc_results if r.flag == "fail"])
        }
    }

@router.get("/qc-results", response_model=List[QCResultSchema])
async def list_qc_results(
    batch_id: Optional[UUID] = Query(None),
    element: Optional[str] = Query(None),
    flag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List QC results"""
    
    query = db.query(QCResult)
    
    if batch_id:
        query = query.filter(QCResult.batch_id == batch_id)
    
    if element:
        query = query.filter(QCResult.element == element)
    
    if flag:
        query = query.filter(QCResult.flag == flag)
    
    results = query.order_by(QCResult.created_at.desc()).all()
    return results

# Bulk import endpoints
@router.post("/import/csv")
async def import_geochemistry_csv(
    file: UploadFile = File(...),
    project_id: UUID = Query(...),
    data_type: str = Query(..., regex="^(samples|results)$"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Import geochemistry data from CSV file"""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    try:
        # Read CSV file
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        
        # Validate and import data based on type
        if data_type == "samples":
            imported_count = await import_sample_data(db, df, project_id)
        elif data_type == "results":
            imported_count = await import_result_data(db, df, project_id)
        
        return SuccessResponse(
            message=f"Successfully imported {imported_count} {data_type} records",
            data={"imported_count": imported_count}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import failed: {str(e)}"
        )

# Export endpoints
@router.post("/export/{format}")
async def export_geochemistry_data(
    format: str,
    project_id: UUID = Query(...),
    data_type: str = Query(..., regex="^(samples|results|qc|all)$"),
    include_qc: bool = Query(False),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export geochemistry data in various formats"""
    
    if format not in ["csv", "xlsx", "json", "pdf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format"
        )
    
    # Create export job
    export_job = await create_export_job(
        db=db,
        module="geochemistry",
        format=format,
        project_id=project_id,
        filters={"data_type": data_type, "include_qc": include_qc}
    )
    
    return {"job_id": export_job.id, "status": "pending"}

# Statistics endpoints
@router.get("/statistics/{project_id}")
async def get_geochemistry_statistics(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get geochemistry statistics for a project"""
    
    # Sample statistics
    total_samples = db.query(GeochemSample).filter(
        GeochemSample.project_id == project_id
    ).count()
    
    samples_by_type = db.query(
        GeochemSample.sample_type,
        db.func.count(GeochemSample.id)
    ).filter(
        GeochemSample.project_id == project_id
    ).group_by(GeochemSample.sample_type).all()
    
    # Result statistics
    total_results = db.query(GeochemResult).join(GeochemSample).filter(
        GeochemSample.project_id == project_id
    ).count()
    
    # QC statistics
    total_batches = db.query(COCBatch).filter(
        COCBatch.project_id == project_id
    ).count()
    
    qc_summary = db.query(
        QCResult.flag,
        db.func.count(QCResult.id)
    ).join(COCBatch).filter(
        COCBatch.project_id == project_id
    ).group_by(QCResult.flag).all()
    
    return {
        "samples": {
            "total": total_samples,
            "by_type": dict(samples_by_type)
        },
        "results": {
            "total": total_results
        },
        "qc": {
            "total_batches": total_batches,
            "summary": dict(qc_summary)
        }
    }

# Helper functions for import
async def import_sample_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import sample data from DataFrame"""
    
    required_columns = ['sample_id', 'sample_type', 'easting', 'northing']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    imported_count = 0
    
    for _, row in df.iterrows():
        try:
            # Check if sample already exists
            existing = db.query(GeochemSample).filter(
                GeochemSample.project_id == project_id,
                GeochemSample.sample_id == row['sample_id']
            ).first()
            
            if existing:
                continue  # Skip existing samples
            
            # Create sample
            sample_data = {
                'project_id': project_id,
                'sample_id': row['sample_id'],
                'sample_type': row['sample_type'],
                'easting': float(row['easting']),
                'northing': float(row['northing']),
                'elevation': float(row.get('elevation', 0)) if pd.notna(row.get('elevation')) else None,
                'collection_date': row.get('collection_date') if pd.notna(row.get('collection_date')) else None,
                'collector': row.get('collector') if pd.notna(row.get('collector')) else None,
                'country_code': row.get('country_code', 'AU'),
                'data_classification': 'internal'
            }
            
            sample = GeochemSample(**sample_data)
            sample.geom = f"SRID=4326;POINT({sample_data['easting']} {sample_data['northing']})"
            
            db.add(sample)
            imported_count += 1
            
        except Exception as e:
            print(f"Error importing sample {row.get('sample_id', 'unknown')}: {e}")
            continue
    
    db.commit()
    return imported_count

async def import_result_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import result data from DataFrame"""
    
    required_columns = ['sample_id', 'lab']
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")
    
    # Get element columns (anything not in standard columns)
    standard_columns = ['sample_id', 'lab', 'batch_id', 'analysis_date', 'method']
    element_columns = [col for col in df.columns if col not in standard_columns]
    
    imported_count = 0
    
    for _, row in df.iterrows():
        try:
            # Find sample by sample_id
            sample = db.query(GeochemSample).filter(
                GeochemSample.project_id == project_id,
                GeochemSample.sample_id == row['sample_id']
            ).first()
            
            if not sample:
                continue  # Skip if sample doesn't exist
            
            # Build elements dictionary
            elements = {}
            for col in element_columns:
                if pd.notna(row[col]):
                    # Assume column format is "Element_Unit" or just "Element"
                    if '_' in col:
                        element, unit = col.split('_', 1)
                    else:
                        element = col
                        unit = 'ppm'  # Default unit
                    
                    elements[element] = {
                        'value': float(row[col]),
                        'unit': unit,
                        'detection_limit': None
                    }
            
            if not elements:
                continue  # Skip if no element data
            
            # Create result
            result_data = {
                'sample_id': sample.id,
                'lab': row['lab'],
                'batch_id': row.get('batch_id') if pd.notna(row.get('batch_id')) else None,
                'analysis_date': row.get('analysis_date') if pd.notna(row.get('analysis_date')) else None,
                'method': row.get('method') if pd.notna(row.get('method')) else None,
                'elements': elements
            }
            
            result = GeochemResult(**result_data)
            db.add(result)
            imported_count += 1
            
        except Exception as e:
            print(f"Error importing result for sample {row.get('sample_id', 'unknown')}: {e}")
            continue
    
    db.commit()
    return imported_count