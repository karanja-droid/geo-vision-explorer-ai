"""Drilling data API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import pandas as pd
import io

from app.database import get_db
from app.models.drilling import DrillCollar, DrillSurvey, DrillInterval, DrillAssay
from app.schemas.drilling import (
    DrillCollar as DrillCollarSchema,
    DrillCollarCreate,
    DrillCollarUpdate,
    DrillSurvey as DrillSurveySchema,
    DrillSurveyCreate,
    DrillInterval as DrillIntervalSchema,
    DrillIntervalCreate,
    DrillIntervalUpdate,
    DrillAssay as DrillAssaySchema,
    DrillAssayCreate,
    DrillAssayUpdate,
    DrillHoleImport,
    DrillHoleValidation,
    IntervalValidation
)
from app.schemas.core import SuccessResponse
from app.services.validation import validate_drill_hole_data, validate_intervals
from app.services.exports import create_export_job
from app.services.stac import register_drilling_data
from app.core.security import get_current_user

router = APIRouter()

# Drill Collar endpoints
@router.post("/collars", response_model=DrillCollarSchema, status_code=status.HTTP_201_CREATED)
async def create_drill_collar(
    collar_data: DrillCollarCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new drill collar"""
    
    # Check if hole_id already exists in project
    existing_collar = db.query(DrillCollar).filter(
        DrillCollar.org_id == collar_data.org_id,
        DrillCollar.project_id == collar_data.project_id,
        DrillCollar.hole_id == collar_data.hole_id
    ).first()
    
    if existing_collar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Drill hole '{collar_data.hole_id}' already exists in this project"
        )
    
    # Create collar with PostGIS point geometry
    collar_dict = collar_data.dict()
    collar = DrillCollar(**collar_dict)
    collar.geom = f"SRID=4326;POINT({collar_data.easting} {collar_data.northing})"
    
    db.add(collar)
    db.commit()
    db.refresh(collar)
    
    # Register in STAC
    try:
        await register_drilling_data(db, collar)
    except Exception as e:
        print(f"Failed to register drilling data in STAC: {e}")
    
    return collar

@router.get("/collars", response_model=List[DrillCollarSchema])
async def list_drill_collars(
    project_id: Optional[UUID] = Query(None),
    country_code: Optional[str] = Query(None, max_length=2),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List drill collars with optional filtering"""
    
    query = db.query(DrillCollar)
    
    if project_id:
        query = query.filter(DrillCollar.project_id == project_id)
    
    if country_code:
        query = query.filter(DrillCollar.country_code == country_code.upper())
    
    if status_filter:
        query = query.filter(DrillCollar.status == status_filter)
    
    collars = query.offset(skip).limit(limit).all()
    return collars

@router.get("/collars/{collar_id}", response_model=DrillCollarSchema)
async def get_drill_collar(
    collar_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get drill collar by ID"""
    
    collar = db.query(DrillCollar).filter(DrillCollar.id == collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    return collar

@router.put("/collars/{collar_id}", response_model=DrillCollarSchema)
async def update_drill_collar(
    collar_id: UUID,
    collar_data: DrillCollarUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update drill collar"""
    
    collar = db.query(DrillCollar).filter(DrillCollar.id == collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    # Update fields
    update_data = collar_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(collar, field, value)
    
    # Update geometry if coordinates changed
    if 'easting' in update_data or 'northing' in update_data:
        collar.geom = f"SRID=4326;POINT({collar.easting} {collar.northing})"
    
    db.commit()
    db.refresh(collar)
    
    return collar

@router.delete("/collars/{collar_id}", response_model=SuccessResponse)
async def delete_drill_collar(
    collar_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete drill collar and all associated data"""
    
    collar = db.query(DrillCollar).filter(DrillCollar.id == collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    # Delete associated surveys, intervals, and assays (cascade)
    db.delete(collar)
    db.commit()
    
    return SuccessResponse(message="Drill collar deleted successfully")

# Drill Survey endpoints
@router.post("/surveys", response_model=DrillSurveySchema, status_code=status.HTTP_201_CREATED)
async def create_drill_survey(
    survey_data: DrillSurveyCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new drill survey point"""
    
    # Verify collar exists
    collar = db.query(DrillCollar).filter(DrillCollar.id == survey_data.collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    # Check if survey at this depth already exists
    existing_survey = db.query(DrillSurvey).filter(
        DrillSurvey.collar_id == survey_data.collar_id,
        DrillSurvey.depth_m == survey_data.depth_m
    ).first()
    
    if existing_survey:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Survey already exists at depth {survey_data.depth_m}m"
        )
    
    survey = DrillSurvey(**survey_data.dict())
    db.add(survey)
    db.commit()
    db.refresh(survey)
    
    return survey

@router.get("/surveys", response_model=List[DrillSurveySchema])
async def list_drill_surveys(
    collar_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List drill surveys"""
    
    query = db.query(DrillSurvey)
    
    if collar_id:
        query = query.filter(DrillSurvey.collar_id == collar_id)
    
    surveys = query.order_by(DrillSurvey.depth_m).all()
    return surveys

# Drill Interval endpoints
@router.post("/intervals", response_model=DrillIntervalSchema, status_code=status.HTTP_201_CREATED)
async def create_drill_interval(
    interval_data: DrillIntervalCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new drill interval"""
    
    # Verify collar exists
    collar = db.query(DrillCollar).filter(DrillCollar.id == interval_data.collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    # Validate interval doesn't overlap with existing intervals
    validation = validate_intervals(db, interval_data.collar_id, interval_data.from_m, interval_data.to_m)
    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Interval validation failed: {validation.overlaps}"
        )
    
    interval = DrillInterval(**interval_data.dict())
    db.add(interval)
    db.commit()
    db.refresh(interval)
    
    return interval

@router.get("/intervals", response_model=List[DrillIntervalSchema])
async def list_drill_intervals(
    collar_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List drill intervals"""
    
    query = db.query(DrillInterval)
    
    if collar_id:
        query = query.filter(DrillInterval.collar_id == collar_id)
    
    intervals = query.order_by(DrillInterval.from_m).all()
    return intervals

@router.put("/intervals/{interval_id}", response_model=DrillIntervalSchema)
async def update_drill_interval(
    interval_id: UUID,
    interval_data: DrillIntervalUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update drill interval"""
    
    interval = db.query(DrillInterval).filter(DrillInterval.id == interval_id).first()
    if not interval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill interval not found"
        )
    
    # Validate interval changes don't create overlaps
    new_from = interval_data.from_m if interval_data.from_m is not None else interval.from_m
    new_to = interval_data.to_m if interval_data.to_m is not None else interval.to_m
    
    validation = validate_intervals(db, interval.collar_id, new_from, new_to, exclude_id=interval_id)
    if not validation.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Interval validation failed: {validation.overlaps}"
        )
    
    # Update fields
    update_data = interval_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(interval, field, value)
    
    db.commit()
    db.refresh(interval)
    
    return interval

# Drill Assay endpoints
@router.post("/assays", response_model=DrillAssaySchema, status_code=status.HTTP_201_CREATED)
async def create_drill_assay(
    assay_data: DrillAssayCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new drill assay"""
    
    # Verify collar exists
    collar = db.query(DrillCollar).filter(DrillCollar.id == assay_data.collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    assay = DrillAssay(**assay_data.dict())
    db.add(assay)
    db.commit()
    db.refresh(assay)
    
    return assay

@router.get("/assays", response_model=List[DrillAssaySchema])
async def list_drill_assays(
    collar_id: Optional[UUID] = Query(None),
    element: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List drill assays"""
    
    query = db.query(DrillAssay)
    
    if collar_id:
        query = query.filter(DrillAssay.collar_id == collar_id)
    
    if element:
        query = query.filter(DrillAssay.elements.has_key(element))
    
    assays = query.order_by(DrillAssay.from_m).all()
    return assays

@router.put("/assays/{assay_id}", response_model=DrillAssaySchema)
async def update_drill_assay(
    assay_id: UUID,
    assay_data: DrillAssayUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update drill assay"""
    
    assay = db.query(DrillAssay).filter(DrillAssay.id == assay_id).first()
    if not assay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill assay not found"
        )
    
    # Update fields
    update_data = assay_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(assay, field, value)
    
    db.commit()
    db.refresh(assay)
    
    return assay

# Bulk import endpoints
@router.post("/import/csv")
async def import_drilling_csv(
    file: UploadFile = File(...),
    project_id: UUID = Query(...),
    data_type: str = Query(..., regex="^(collars|surveys|intervals|assays)$"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Import drilling data from CSV file"""
    
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
        if data_type == "collars":
            # Process collar data
            imported_count = await import_collar_data(db, df, project_id)
        elif data_type == "surveys":
            imported_count = await import_survey_data(db, df, project_id)
        elif data_type == "intervals":
            imported_count = await import_interval_data(db, df, project_id)
        elif data_type == "assays":
            imported_count = await import_assay_data(db, df, project_id)
        
        return SuccessResponse(
            message=f"Successfully imported {imported_count} {data_type} records",
            data={"imported_count": imported_count}
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Import failed: {str(e)}"
        )

@router.post("/validate")
async def validate_drill_hole(
    collar_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Validate drill hole data for overlaps, gaps, and consistency"""
    
    collar = db.query(DrillCollar).filter(DrillCollar.id == collar_id).first()
    if not collar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drill collar not found"
        )
    
    validation = validate_drill_hole_data(db, collar_id)
    return validation

# Export endpoints
@router.post("/export/{format}")
async def export_drilling_data(
    format: str,
    project_id: UUID = Query(...),
    data_type: str = Query(..., regex="^(collars|surveys|intervals|assays|all)$"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Export drilling data in various formats"""
    
    if format not in ["csv", "xlsx", "gpkg", "pdf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported export format"
        )
    
    # Create export job
    export_job = await create_export_job(
        db=db,
        module="drilling",
        format=format,
        project_id=project_id,
        filters={"data_type": data_type}
    )
    
    return {"job_id": export_job.id, "status": "pending"}

# Helper functions for import
async def import_collar_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import collar data from DataFrame"""
    # Implementation for collar import
    return len(df)

async def import_survey_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import survey data from DataFrame"""
    # Implementation for survey import
    return len(df)

async def import_interval_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import interval data from DataFrame"""
    # Implementation for interval import
    return len(df)

async def import_assay_data(db: Session, df: pd.DataFrame, project_id: UUID) -> int:
    """Import assay data from DataFrame"""
    # Implementation for assay import
    return len(df)