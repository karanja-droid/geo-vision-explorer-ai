"""Geologist module API endpoints."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from pydantic import BaseModel, Field, validator
import json

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models.core import User, FieldObservation, GeologicalTarget
from ...core.permissions import check_permission, require_role
from ...services.validation import ValidationService

router = APIRouter(prefix="/geologist", tags=["geologist"])

# Pydantic models
class FieldObservationCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    observation_type: str = Field(..., max_length=50)  # outcrop, structure, lithology, alteration
    location: Dict[str, Any]  # GeoJSON Point
    elevation: Optional[float] = None
    description: str = Field(..., min_length=10)
    lithology: Optional[str] = Field(None, max_length=100)
    structure_type: Optional[str] = Field(None, max_length=50)
    strike: Optional[float] = Field(None, ge=0, le=360)
    dip: Optional[float] = Field(None, ge=0, le=90)
    mineralization: Optional[str] = None
    alteration: Optional[str] = None
    photos: Optional[List[Dict[str, Any]]] = None
    geologist: str = Field(..., max_length=100)
    observation_date: datetime
    weather_conditions: Optional[str] = Field(None, max_length=100)
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
        lon, lat = coordinates
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise ValueError('Invalid coordinates: longitude [-180,180], latitude [-90,90]')
        return v

    @validator('strike')
    def validate_strike(cls, v):
        """Validate strike measurement."""
        if v is not None and not (0 <= v <= 360):
            raise ValueError('Strike must be between 0 and 360 degrees')
        return v

    @validator('dip')
    def validate_dip(cls, v):
        """Validate dip measurement."""
        if v is not None and not (0 <= v <= 90):
            raise ValueError('Dip must be between 0 and 90 degrees')
        return v

class FieldObservationUpdate(BaseModel):
    observation_type: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    elevation: Optional[float] = None
    description: Optional[str] = None
    lithology: Optional[str] = None
    structure_type: Optional[str] = None
    strike: Optional[float] = None
    dip: Optional[float] = None
    mineralization: Optional[str] = None
    alteration: Optional[str] = None
    photos: Optional[List[Dict[str, Any]]] = None
    weather_conditions: Optional[str] = None

class FieldObservationResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    observation_type: str
    location: Dict[str, Any]
    elevation: Optional[float]
    description: str
    lithology: Optional[str]
    structure_type: Optional[str]
    strike: Optional[float]
    dip: Optional[float]
    mineralization: Optional[str]
    alteration: Optional[str]
    photos: Optional[List[Dict[str, Any]]]
    geologist: str
    observation_date: datetime
    weather_conditions: Optional[str]
    created_at: datetime
    updated_at: datetime

class GeologicalTargetCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    target_name: str = Field(..., max_length=100)
    target_type: str = Field(..., max_length=50)  # drill, geophysics, geochemistry, mapping
    geometry: Dict[str, Any]  # GeoJSON Polygon or Point
    priority: str = Field(default="medium", regex="^(low|medium|high|critical)$")
    rationale: str = Field(..., min_length=20)
    commodity: str = Field(..., max_length=50)
    confidence_level: Optional[float] = Field(None, ge=0, le=1)
    prospectivity_score: Optional[float] = Field(None, ge=0, le=1)
    assigned_to: Optional[UUID] = None
    target_date: Optional[datetime] = None
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

    @validator('geometry')
    def validate_geometry(cls, v):
        """Validate GeoJSON geometry."""
        if not isinstance(v, dict):
            raise ValueError('Geometry must be a GeoJSON object')
        geom_type = v.get('type')
        if geom_type not in ['Point', 'Polygon', 'MultiPolygon']:
            raise ValueError('Geometry must be Point, Polygon, or MultiPolygon')
        if 'coordinates' not in v:
            raise ValueError('Geometry must have coordinates')
        return v

class GeologicalTargetUpdate(BaseModel):
    target_name: Optional[str] = None
    target_type: Optional[str] = None
    geometry: Optional[Dict[str, Any]] = None
    priority: Optional[str] = None
    rationale: Optional[str] = None
    commodity: Optional[str] = None
    confidence_level: Optional[float] = None
    prospectivity_score: Optional[float] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    target_date: Optional[datetime] = None

class GeologicalTargetResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    target_name: str
    target_type: str
    geometry: Dict[str, Any]
    priority: str
    rationale: str
    commodity: str
    confidence_level: Optional[float]
    prospectivity_score: Optional[float]
    status: str
    assigned_to: Optional[UUID]
    target_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class GeologistDashboardData(BaseModel):
    total_observations: int
    recent_observations: int
    active_targets: int
    high_priority_targets: int
    observations_by_type: Dict[str, int]
    targets_by_commodity: Dict[str, int]
    completion_rate: float
    field_days_this_month: int

# Field Observations endpoints
@router.post("/field-observations", response_model=FieldObservationResponse)
async def create_field_observation(
    observation: FieldObservationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new field observation."""
    
    await require_role(db, current_user.id, ["administrator", "geologist", "geophysicist"])
    
    # Validate location coordinates
    validation_service = ValidationService()
    if not validation_service.validate_coordinates(observation.location['coordinates']):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    db_observation = FieldObservation(
        org_id=current_user.org_id,
        **observation.dict(exclude={'location'}),
        location=json.dumps(observation.location)
    )
    
    db.add(db_observation)
    await db.commit()
    await db.refresh(db_observation)
    
    # Convert location back to dict for response
    response_data = db_observation.__dict__.copy()
    response_data['location'] = json.loads(db_observation.location)
    
    return FieldObservationResponse(**response_data)

@router.get("/field-observations", response_model=List[FieldObservationResponse])
async def list_field_observations(
    project_id: Optional[UUID] = Query(None),
    observation_type: Optional[str] = Query(None),
    geologist: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List field observations with optional filters."""
    
    query = select(FieldObservation).where(FieldObservation.org_id == current_user.org_id)
    
    if project_id:
        query = query.where(FieldObservation.project_id == project_id)
    if observation_type:
        query = query.where(FieldObservation.observation_type == observation_type)
    if geologist:
        query = query.where(FieldObservation.geologist.ilike(f"%{geologist}%"))
    if start_date:
        query = query.where(FieldObservation.observation_date >= start_date)
    if end_date:
        query = query.where(FieldObservation.observation_date <= end_date)
    
    query = query.offset(offset).limit(limit).order_by(FieldObservation.observation_date.desc())
    
    result = await db.execute(query)
    observations = result.scalars().all()
    
    # Convert location strings back to dicts
    response_data = []
    for obs in observations:
        obs_dict = obs.__dict__.copy()
        obs_dict['location'] = json.loads(obs.location)
        response_data.append(FieldObservationResponse(**obs_dict))
    
    return response_data

@router.get("/field-observations/{observation_id}", response_model=FieldObservationResponse)
async def get_field_observation(
    observation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific field observation."""
    
    result = await db.execute(
        select(FieldObservation).where(
            and_(
                FieldObservation.id == observation_id,
                FieldObservation.org_id == current_user.org_id
            )
        )
    )
    observation = result.scalar_one_or_none()
    
    if not observation:
        raise HTTPException(status_code=404, detail="Field observation not found")
    
    response_data = observation.__dict__.copy()
    response_data['location'] = json.loads(observation.location)
    
    return FieldObservationResponse(**response_data)

@router.put("/field-observations/{observation_id}", response_model=FieldObservationResponse)
async def update_field_observation(
    observation_id: UUID,
    observation_update: FieldObservationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a field observation."""
    
    await require_role(db, current_user.id, ["administrator", "geologist"])
    
    result = await db.execute(
        select(FieldObservation).where(
            and_(
                FieldObservation.id == observation_id,
                FieldObservation.org_id == current_user.org_id
            )
        )
    )
    observation = result.scalar_one_or_none()
    
    if not observation:
        raise HTTPException(status_code=404, detail="Field observation not found")
    
    # Update fields
    update_data = observation_update.dict(exclude_unset=True)
    if 'location' in update_data:
        update_data['location'] = json.dumps(update_data['location'])
    
    for field, value in update_data.items():
        setattr(observation, field, value)
    
    observation.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(observation)
    
    response_data = observation.__dict__.copy()
    response_data['location'] = json.loads(observation.location)
    
    return FieldObservationResponse(**response_data)

# Geological Targets endpoints
@router.post("/targets", response_model=GeologicalTargetResponse)
async def create_geological_target(
    target: GeologicalTargetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new geological target."""
    
    await require_role(db, current_user.id, ["administrator", "geologist"])
    
    db_target = GeologicalTarget(
        org_id=current_user.org_id,
        **target.dict(exclude={'geometry'}),
        geometry=json.dumps(target.geometry)
    )
    
    db.add(db_target)
    await db.commit()
    await db.refresh(db_target)
    
    response_data = db_target.__dict__.copy()
    response_data['geometry'] = json.loads(db_target.geometry)
    
    return GeologicalTargetResponse(**response_data)

@router.get("/targets", response_model=List[GeologicalTargetResponse])
async def list_geological_targets(
    project_id: Optional[UUID] = Query(None),
    target_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None),
    assigned_to: Optional[UUID] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List geological targets with optional filters."""
    
    query = select(GeologicalTarget).where(GeologicalTarget.org_id == current_user.org_id)
    
    if project_id:
        query = query.where(GeologicalTarget.project_id == project_id)
    if target_type:
        query = query.where(GeologicalTarget.target_type == target_type)
    if priority:
        query = query.where(GeologicalTarget.priority == priority)
    if status:
        query = query.where(GeologicalTarget.status == status)
    if commodity:
        query = query.where(GeologicalTarget.commodity.ilike(f"%{commodity}%"))
    if assigned_to:
        query = query.where(GeologicalTarget.assigned_to == assigned_to)
    
    query = query.offset(offset).limit(limit).order_by(GeologicalTarget.created_at.desc())
    
    result = await db.execute(query)
    targets = result.scalars().all()
    
    # Convert geometry strings back to dicts
    response_data = []
    for target in targets:
        target_dict = target.__dict__.copy()
        target_dict['geometry'] = json.loads(target.geometry)
        response_data.append(GeologicalTargetResponse(**target_dict))
    
    return response_data

@router.put("/targets/{target_id}/assign")
async def assign_geological_target(
    target_id: UUID,
    assigned_to: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a geological target to a team member."""
    
    await require_role(db, current_user.id, ["administrator", "geologist"])
    
    result = await db.execute(
        select(GeologicalTarget).where(
            and_(
                GeologicalTarget.id == target_id,
                GeologicalTarget.org_id == current_user.org_id
            )
        )
    )
    target = result.scalar_one_or_none()
    
    if not target:
        raise HTTPException(status_code=404, detail="Geological target not found")
    
    target.assigned_to = assigned_to
    target.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Target assigned successfully"}

# Dashboard and analytics endpoints
@router.get("/dashboard", response_model=GeologistDashboardData)
async def get_geologist_dashboard(
    project_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get geologist dashboard data."""
    
    await require_role(db, current_user.id, ["administrator", "geologist"])
    
    # Base queries
    obs_query = select(FieldObservation).where(FieldObservation.org_id == current_user.org_id)
    target_query = select(GeologicalTarget).where(GeologicalTarget.org_id == current_user.org_id)
    
    if project_id:
        obs_query = obs_query.where(FieldObservation.project_id == project_id)
        target_query = target_query.where(GeologicalTarget.project_id == project_id)
    
    # Total observations
    total_obs_result = await db.execute(
        select(func.count(FieldObservation.id)).select_from(obs_query.subquery())
    )
    total_observations = total_obs_result.scalar() or 0
    
    # Recent observations (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_obs_result = await db.execute(
        obs_query.where(FieldObservation.observation_date >= thirty_days_ago)
        .with_only_columns([func.count(FieldObservation.id)])
    )
    recent_observations = recent_obs_result.scalar() or 0
    
    # Active targets
    active_targets_result = await db.execute(
        target_query.where(GeologicalTarget.status == 'active')
        .with_only_columns([func.count(GeologicalTarget.id)])
    )
    active_targets = active_targets_result.scalar() or 0
    
    # High priority targets
    high_priority_result = await db.execute(
        target_query.where(
            and_(
                GeologicalTarget.status == 'active',
                or_(
                    GeologicalTarget.priority == 'high',
                    GeologicalTarget.priority == 'critical'
                )
            )
        ).with_only_columns([func.count(GeologicalTarget.id)])
    )
    high_priority_targets = high_priority_result.scalar() or 0
    
    # Observations by type
    obs_by_type_result = await db.execute(
        select(
            FieldObservation.observation_type,
            func.count(FieldObservation.id).label('count')
        ).where(FieldObservation.org_id == current_user.org_id)
        .group_by(FieldObservation.observation_type)
    )
    observations_by_type = {row.observation_type: row.count for row in obs_by_type_result}
    
    # Targets by commodity
    targets_by_commodity_result = await db.execute(
        select(
            GeologicalTarget.commodity,
            func.count(GeologicalTarget.id).label('count')
        ).where(GeologicalTarget.org_id == current_user.org_id)
        .group_by(GeologicalTarget.commodity)
    )
    targets_by_commodity = {row.commodity: row.count for row in targets_by_commodity_result}
    
    # Calculate completion rate (completed targets / total targets)
    completed_targets_result = await db.execute(
        target_query.where(GeologicalTarget.status == 'completed')
        .with_only_columns([func.count(GeologicalTarget.id)])
    )
    completed_targets = completed_targets_result.scalar() or 0
    total_targets = active_targets + completed_targets
    completion_rate = (completed_targets / total_targets * 100) if total_targets > 0 else 0
    
    # Field days this month (unique observation dates)
    from datetime import date
    current_month_start = date.today().replace(day=1)
    field_days_result = await db.execute(
        select(func.count(func.distinct(func.date(FieldObservation.observation_date))))
        .where(
            and_(
                FieldObservation.org_id == current_user.org_id,
                FieldObservation.observation_date >= current_month_start
            )
        )
    )
    field_days_this_month = field_days_result.scalar() or 0
    
    return GeologistDashboardData(
        total_observations=total_observations,
        recent_observations=recent_observations,
        active_targets=active_targets,
        high_priority_targets=high_priority_targets,
        observations_by_type=observations_by_type,
        targets_by_commodity=targets_by_commodity,
        completion_rate=completion_rate,
        field_days_this_month=field_days_this_month
    )

# Photo upload endpoint
@router.post("/field-observations/{observation_id}/photos")
async def upload_observation_photos(
    observation_id: UUID,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload photos for a field observation."""
    
    await require_role(db, current_user.id, ["administrator", "geologist"])
    
    # Validate file types and sizes
    allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
    max_size = 10 * 1024 * 1024  # 10MB
    
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, WebP"
            )
        
        # Check file size (approximate)
        content = await file.read()
        if len(content) > max_size:
            raise HTTPException(status_code=400, detail=f"File too large: {file.filename}")
        
        # Reset file pointer
        await file.seek(0)
    
    # Get observation
    result = await db.execute(
        select(FieldObservation).where(
            and_(
                FieldObservation.id == observation_id,
                FieldObservation.org_id == current_user.org_id
            )
        )
    )
    observation = result.scalar_one_or_none()
    
    if not observation:
        raise HTTPException(status_code=404, detail="Field observation not found")
    
    # Upload files to S3 and update observation
    from ...services.export_service import ExportService
    export_service = ExportService()
    
    photo_metadata = []
    for file in files:
        # Generate S3 key
        s3_key = f"field-photos/{current_user.org_id}/{observation_id}/{file.filename}"
        
        # Upload to S3
        content = await file.read()
        import tempfile
        with tempfile.NamedTemporaryFile() as temp_file:
            temp_file.write(content)
            temp_file.flush()
            
            await export_service.upload_to_s3(
                temp_file.name, s3_key, file.content_type
            )
        
        # Generate signed URL
        photo_url = export_service.generate_signed_url(s3_key, expiration=86400 * 7)  # 7 days
        
        photo_metadata.append({
            'filename': file.filename,
            'url': photo_url,
            's3_key': s3_key,
            'content_type': file.content_type,
            'uploaded_at': datetime.utcnow().isoformat(),
            'uploaded_by': str(current_user.id)
        })
    
    # Update observation with photo metadata
    existing_photos = json.loads(observation.photos) if observation.photos else []
    existing_photos.extend(photo_metadata)
    
    observation.photos = json.dumps(existing_photos)
    observation.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": f"Uploaded {len(files)} photos successfully",
        "photos": photo_metadata
    }