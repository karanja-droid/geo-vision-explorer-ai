"""Geochemist/LIMS module API endpoints."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc
from pydantic import BaseModel, Field, validator
import json
import pandas as pd
import io

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models.core import User
from ...core.permissions import check_permission, require_role
from ...services.validation import ValidationService

router = APIRouter(prefix="/geochemist", tags=["geochemist"])

# Pydantic models
class SampleRegistrationCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    sample_id: str = Field(..., max_length=50)
    sample_type: str = Field(..., max_length=50)
    location: Dict[str, Any]  # GeoJSON Point
    elevation: Optional[float] = None
    sample_date: datetime
    collected_by: str = Field(..., max_length=100)
    sample_weight: Optional[float] = Field(None, gt=0)
    sample_description: Optional[str] = None
    preparation_method: Optional[str] = None
    analytical_method: Optional[str] = None
    laboratory: Optional[str] = None
    batch_id: Optional[str] = None
    qc_type: Optional[str] = None
    parent_sample_id: Optional[str] = None
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

    @validator('location')
    def validate_location(cls, v):
        """Validate GeoJSON Point format."""
        if not isinstance(v, dict):
            raise ValueError('Location must be a GeoJSON Point object')
        if v.get('type') != 'Point':
            raise ValueError('Location must be a GeoJSON Point')
        coordinates = v.get('coordinates')
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            raise ValueError('Point coordinates must be [longitude, latitude]')
        return v

    @validator('sample_type')
    def validate_sample_type(cls, v):
        """Validate sample type."""
        valid_types = [
            'rock', 'soil', 'stream_sediment', 'drill_core', 'drill_cuttings',
            'channel', 'grab', 'composite', 'bulk', 'concentrate'
        ]
        if v not in valid_types:
            raise ValueError(f'Sample type must be one of: {", ".join(valid_types)}')
        return v

class AssayResultCreate(BaseModel):
    sample_registration_id: UUID
    sample_id: str = Field(..., max_length=50)
    element: str = Field(..., max_length=10)
    value: Optional[float] = None
    unit: str = Field(..., max_length=10)
    detection_limit: Optional[float] = None
    method: Optional[str] = None
    laboratory: str = Field(..., max_length=100)
    batch_id: Optional[str] = None
    certificate_number: Optional[str] = None
    analysis_date: Optional[datetime] = None
    received_date: Optional[datetime] = None
    reported_date: Optional[datetime] = None
    over_limit: bool = False
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

    @validator('element')
    def validate_element(cls, v):
        """Validate chemical element."""
        # Common elements in mining
        valid_elements = [
            'Au', 'Ag', 'Cu', 'Pb', 'Zn', 'Ni', 'Co', 'Pt', 'Pd', 'Mo', 'W', 'Sn',
            'Fe', 'Al', 'Mg', 'Ca', 'K', 'Na', 'Ti', 'Mn', 'Cr', 'V', 'As', 'Sb',
            'Bi', 'Cd', 'Hg', 'Tl', 'U', 'Th', 'REE', 'Li', 'Be', 'Cs', 'Rb', 'Sr',
            'Ba', 'S', 'P', 'C', 'SiO2', 'Al2O3', 'Fe2O3', 'MgO', 'CaO', 'Na2O', 'K2O'
        ]
        if v not in valid_elements:
            raise ValueError(f'Element must be one of the supported elements')
        return v

class QCStandardCreate(BaseModel):
    standard_id: str = Field(..., max_length=50)
    standard_type: str = Field(..., regex="^(crm|blank|duplicate)$")
    supplier: Optional[str] = None
    matrix: Optional[str] = None
    certified_values: Dict[str, Dict[str, Any]]  # {element: {value, uncertainty, unit}}
    acceptable_ranges: Optional[Dict[str, Dict[str, float]]] = None
    description: Optional[str] = None

class GeochemistDashboardData(BaseModel):
    total_samples: int
    pending_samples: int
    completed_assays: int
    qc_pass_rate: float
    samples_by_type: Dict[str, int]
    elements_analyzed: Dict[str, int]
    laboratory_performance: Dict[str, float]
    recent_batches: int
    average_tat_days: float
    cost_per_sample: float

# Sample Registration endpoints
@router.post("/samples", response_model=Dict[str, Any])
async def register_sample(
    sample: SampleRegistrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Register a new sample."""
    
    await require_role(db, current_user.id, ["administrator", "geochemist", "geologist"])
    
    # Check for duplicate sample ID
    from ...models.core import SampleRegistration
    
    existing_result = await db.execute(
        select(SampleRegistration).where(
            and_(
                SampleRegistration.org_id == current_user.org_id,
                SampleRegistration.sample_id == sample.sample_id
            )
        )
    )
    existing_sample = existing_result.scalar_one_or_none()
    
    if existing_sample:
        raise HTTPException(status_code=400, detail=f"Sample ID {sample.sample_id} already exists")
    
    # Validate location coordinates
    validation_service = ValidationService()
    if not validation_service.validate_coordinates(sample.location['coordinates']):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    db_sample = SampleRegistration(
        org_id=current_user.org_id,
        **sample.dict(exclude={'location'}),
        location=json.dumps(sample.location)
    )
    
    db.add(db_sample)
    await db.commit()
    await db.refresh(db_sample)
    
    return {"id": str(db_sample.id), "sample_id": db_sample.sample_id, "status": "registered"}

@router.post("/samples/bulk-import")
async def bulk_import_samples(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk import samples from CSV/Excel file."""
    
    await require_role(db, current_user.id, ["administrator", "geochemist"])
    
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        # Read file content
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Validate required columns
        required_columns = ['sample_id', 'sample_type', 'longitude', 'latitude', 'sample_date', 'collected_by']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Process samples
        from ...models.core import SampleRegistration
        imported_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Check for duplicate
                existing_result = await db.execute(
                    select(SampleRegistration).where(
                        and_(
                            SampleRegistration.org_id == current_user.org_id,
                            SampleRegistration.sample_id == row['sample_id']
                        )
                    )
                )
                if existing_result.scalar_one_or_none():
                    errors.append(f"Row {index + 1}: Sample ID {row['sample_id']} already exists")
                    continue
                
                # Create sample
                location = {
                    "type": "Point",
                    "coordinates": [float(row['longitude']), float(row['latitude'])]
                }
                
                db_sample = SampleRegistration(
                    org_id=current_user.org_id,
                    project_id=row.get('project_id'),
                    country_code=row.get('country_code', 'US'),
                    sample_id=row['sample_id'],
                    sample_type=row['sample_type'],
                    location=json.dumps(location),
                    elevation=row.get('elevation'),
                    sample_date=pd.to_datetime(row['sample_date']),
                    collected_by=row['collected_by'],
                    sample_weight=row.get('sample_weight'),
                    sample_description=row.get('sample_description'),
                    laboratory=row.get('laboratory'),
                    batch_id=row.get('batch_id')
                )
                
                db.add(db_sample)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 1}: {str(e)}")
        
        await db.commit()
        
        return {
            "imported_count": imported_count,
            "total_rows": len(df),
            "errors": errors[:10]  # Limit errors shown
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File processing error: {str(e)}")

@router.post("/assays", response_model=Dict[str, Any])
async def create_assay_result(
    assay: AssayResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create an assay result."""
    
    await require_role(db, current_user.id, ["administrator", "geochemist"])
    
    from ...models.core import AssayResult, SampleRegistration
    
    # Verify sample exists
    sample_result = await db.execute(
        select(SampleRegistration).where(
            and_(
                SampleRegistration.id == assay.sample_registration_id,
                SampleRegistration.org_id == current_user.org_id
            )
        )
    )
    sample = sample_result.scalar_one_or_none()
    
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    # Check for duplicate assay
    existing_result = await db.execute(
        select(AssayResult).where(
            and_(
                AssayResult.sample_registration_id == assay.sample_registration_id,
                AssayResult.element == assay.element,
                AssayResult.method == assay.method
            )
        )
    )
    existing_assay = existing_result.scalar_one_or_none()
    
    if existing_assay:
        raise HTTPException(
            status_code=400, 
            detail=f"Assay result already exists for {assay.element} using {assay.method}"
        )
    
    db_assay = AssayResult(
        org_id=current_user.org_id,
        project_id=sample.project_id,
        country_code=sample.country_code,
        data_classification=sample.data_classification,
        **assay.dict()
    )
    
    db.add(db_assay)
    await db.commit()
    await db.refresh(db_assay)
    
    return {"id": str(db_assay.id), "element": db_assay.element, "value": db_assay.value}

@router.get("/dashboard", response_model=GeochemistDashboardData)
async def get_geochemist_dashboard(
    project_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get geochemist dashboard data."""
    
    await require_role(db, current_user.id, ["administrator", "geochemist"])
    
    from ...models.core import SampleRegistration, AssayResult, QCResult, LaboratoryPerformance
    
    # Base queries
    samples_query = select(SampleRegistration).where(SampleRegistration.org_id == current_user.org_id)
    assays_query = select(AssayResult).where(AssayResult.org_id == current_user.org_id)
    
    if project_id:
        samples_query = samples_query.where(SampleRegistration.project_id == project_id)
        assays_query = assays_query.where(AssayResult.project_id == project_id)
    
    # Total samples
    total_samples_result = await db.execute(
        samples_query.with_only_columns([func.count(SampleRegistration.id)])
    )
    total_samples = total_samples_result.scalar() or 0
    
    # Pending samples
    pending_samples_result = await db.execute(
        samples_query.where(SampleRegistration.status.in_(['registered', 'submitted']))
        .with_only_columns([func.count(SampleRegistration.id)])
    )
    pending_samples = pending_samples_result.scalar() or 0
    
    # Completed assays
    completed_assays_result = await db.execute(
        assays_query.where(AssayResult.value.isnot(None))
        .with_only_columns([func.count(AssayResult.id)])
    )
    completed_assays = completed_assays_result.scalar() or 0
    
    # QC pass rate
    qc_results_result = await db.execute(
        select(
            func.count(QCResult.id).label('total'),
            func.sum(func.case([(QCResult.pass_fail == 'pass', 1)], else_=0)).label('passed')
        ).where(QCResult.org_id == current_user.org_id)
    )
    qc_data = qc_results_result.first()
    qc_pass_rate = (float(qc_data.passed or 0) / float(qc_data.total or 1)) * 100 if qc_data.total else 0
    
    # Samples by type
    samples_by_type_result = await db.execute(
        select(
            SampleRegistration.sample_type,
            func.count(SampleRegistration.id).label('count')
        ).where(SampleRegistration.org_id == current_user.org_id)
        .group_by(SampleRegistration.sample_type)
    )
    samples_by_type = {row.sample_type: row.count for row in samples_by_type_result}
    
    # Elements analyzed
    elements_result = await db.execute(
        select(
            AssayResult.element,
            func.count(AssayResult.id).label('count')
        ).where(AssayResult.org_id == current_user.org_id)
        .group_by(AssayResult.element)
    )
    elements_analyzed = {row.element: row.count for row in elements_result}
    
    # Laboratory performance
    lab_performance_result = await db.execute(
        select(
            LaboratoryPerformance.laboratory,
            func.avg(LaboratoryPerformance.performance_score).label('avg_score')
        ).where(LaboratoryPerformance.org_id == current_user.org_id)
        .group_by(LaboratoryPerformance.laboratory)
    )
    laboratory_performance = {row.laboratory: float(row.avg_score or 0) for row in lab_performance_result}
    
    # Recent batches (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_batches_result = await db.execute(
        select(func.count(func.distinct(SampleRegistration.batch_id)))
        .where(
            and_(
                SampleRegistration.org_id == current_user.org_id,
                SampleRegistration.created_at >= thirty_days_ago,
                SampleRegistration.batch_id.isnot(None)
            )
        )
    )
    recent_batches = recent_batches_result.scalar() or 0
    
    # Average TAT and cost (placeholder calculations)
    average_tat_days = 7.5  # Would calculate from actual lab performance data
    cost_per_sample = 45.0  # Would calculate from actual cost data
    
    return GeochemistDashboardData(
        total_samples=total_samples,
        pending_samples=pending_samples,
        completed_assays=completed_assays,
        qc_pass_rate=qc_pass_rate,
        samples_by_type=samples_by_type,
        elements_analyzed=elements_analyzed,
        laboratory_performance=laboratory_performance,
        recent_batches=recent_batches,
        average_tat_days=average_tat_days,
        cost_per_sample=cost_per_sample
    )

@router.get("/qc/levey-jennings/{element}")
async def get_levey_jennings_data(
    element: str,
    standard_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get Levey-Jennings chart data for QC monitoring."""
    
    await require_role(db, current_user.id, ["administrator", "geochemist"])
    
    from ...models.core import QCResult, QCStandard
    from datetime import timedelta
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = select(QCResult).where(
        and_(
            QCResult.org_id == current_user.org_id,
            QCResult.element == element,
            QCResult.analysis_date >= start_date
        )
    ).order_by(QCResult.analysis_date)
    
    if standard_id:
        # Join with QCStandard to filter by standard_id
        query = query.join(QCStandard).where(QCStandard.standard_id == standard_id)
    
    result = await db.execute(query)
    qc_results = result.scalars().all()
    
    # Format data for Levey-Jennings chart
    chart_data = []
    for qc_result in qc_results:
        chart_data.append({
            "date": qc_result.analysis_date.isoformat(),
            "measured_value": qc_result.measured_value,
            "certified_value": qc_result.certified_value,
            "z_score": qc_result.z_score,
            "pass_fail": qc_result.pass_fail,
            "laboratory": qc_result.laboratory
        })
    
    return {
        "element": element,
        "data": chart_data,
        "control_limits": {
            "warning": 2.0,  # 2 sigma
            "action": 3.0    # 3 sigma
        }
    }