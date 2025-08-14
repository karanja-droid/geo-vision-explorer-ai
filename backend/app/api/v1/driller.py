"""Driller module API endpoints."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_, desc
from pydantic import BaseModel, Field, validator
import json

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models.core import User, DrillPlan, DailyDrillingReport
from ...core.permissions import check_permission, require_role
from ...services.validation import ValidationService

router = APIRouter(prefix="/driller", tags=["driller"])

# Pydantic models
class DrillPlanCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    plan_name: str = Field(..., max_length=100)
    drill_type: str = Field(..., regex="^(diamond|rc|aircore|rotary|percussion)$")
    collar_location: Dict[str, Any]  # GeoJSON Point
    azimuth: float = Field(..., ge=0, le=360)
    dip: float = Field(..., ge=-90, le=90)
    target_depth: float = Field(..., gt=0)
    planned_start_date: datetime
    estimated_duration_days: int = Field(..., gt=0)
    budget_estimate: Optional[float] = Field(None, ge=0)
    currency: str = Field(default="USD", max_length=3)
    drilling_contractor: Optional[str] = Field(None, max_length=100)
    rig_type: Optional[str] = Field(None, max_length=50)
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

    @validator('collar_location')
    def validate_collar_location(cls, v):
        """Validate GeoJSON Point format."""
        if not isinstance(v, dict):
            raise ValueError('Collar location must be a GeoJSON Point object')
        if v.get('type') != 'Point':
            raise ValueError('Collar location must be a GeoJSON Point')
        coordinates = v.get('coordinates')
        if not isinstance(coordinates, list) or len(coordinates) != 2:
            raise ValueError('Point coordinates must be [longitude, latitude]')
        lon, lat = coordinates
        if not (-180 <= lon <= 180) or not (-90 <= lat <= 90):
            raise ValueError('Invalid coordinates: longitude [-180,180], latitude [-90,90]')
        return v

    @validator('azimuth')
    def validate_azimuth(cls, v):
        """Validate azimuth measurement."""
        if not (0 <= v <= 360):
            raise ValueError('Azimuth must be between 0 and 360 degrees')
        return v

    @validator('dip')
    def validate_dip(cls, v):
        """Validate dip measurement."""
        if not (-90 <= v <= 90):
            raise ValueError('Dip must be between -90 and 90 degrees')
        return v

class DrillPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    drill_type: Optional[str] = None
    collar_location: Optional[Dict[str, Any]] = None
    azimuth: Optional[float] = None
    dip: Optional[float] = None
    target_depth: Optional[float] = None
    planned_start_date: Optional[datetime] = None
    estimated_duration_days: Optional[int] = None
    budget_estimate: Optional[float] = None
    drilling_contractor: Optional[str] = None
    rig_type: Optional[str] = None
    status: Optional[str] = None

class DrillPlanResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    plan_name: str
    drill_type: str
    collar_location: Dict[str, Any]
    azimuth: float
    dip: float
    target_depth: float
    planned_start_date: datetime
    estimated_duration_days: int
    budget_estimate: Optional[float]
    currency: str
    drilling_contractor: Optional[str]
    rig_type: Optional[str]
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

class DailyDrillingReportCreate(BaseModel):
    drill_plan_id: UUID
    report_date: date
    shift: str = Field(..., regex="^(day|night|24hr)$")
    metres_drilled: float = Field(default=0, ge=0)
    total_depth: float = Field(..., ge=0)
    core_recovery_percent: Optional[float] = Field(None, ge=0, le=100)
    drilling_fluid: Optional[str] = Field(None, max_length=50)
    downtime_hours: float = Field(default=0, ge=0, le=24)
    downtime_reason: Optional[str] = None
    rop_average: Optional[float] = Field(None, ge=0)  # rate of penetration m/hr
    consumables_used: Optional[Dict[str, Any]] = None
    safety_incidents: int = Field(default=0, ge=0)
    weather_conditions: Optional[str] = Field(None, max_length=100)
    crew_notes: Optional[str] = None
    driller_name: str = Field(..., max_length=100)
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

    @validator('core_recovery_percent')
    def validate_core_recovery(cls, v):
        """Validate core recovery percentage."""
        if v is not None and not (0 <= v <= 100):
            raise ValueError('Core recovery must be between 0 and 100 percent')
        return v

    @validator('downtime_hours')
    def validate_downtime(cls, v):
        """Validate downtime hours."""
        if not (0 <= v <= 24):
            raise ValueError('Downtime hours must be between 0 and 24')
        return v

class DailyDrillingReportUpdate(BaseModel):
    metres_drilled: Optional[float] = None
    total_depth: Optional[float] = None
    core_recovery_percent: Optional[float] = None
    drilling_fluid: Optional[str] = None
    downtime_hours: Optional[float] = None
    downtime_reason: Optional[str] = None
    rop_average: Optional[float] = None
    consumables_used: Optional[Dict[str, Any]] = None
    safety_incidents: Optional[int] = None
    weather_conditions: Optional[str] = None
    crew_notes: Optional[str] = None

class DailyDrillingReportResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    drill_plan_id: UUID
    report_date: date
    shift: str
    metres_drilled: float
    total_depth: float
    core_recovery_percent: Optional[float]
    drilling_fluid: Optional[str]
    downtime_hours: float
    downtime_reason: Optional[str]
    rop_average: Optional[float]
    consumables_used: Optional[Dict[str, Any]]
    safety_incidents: int
    weather_conditions: Optional[str]
    crew_notes: Optional[str]
    driller_name: str
    created_at: datetime
    updated_at: datetime

class DrillerDashboardData(BaseModel):
    active_drill_plans: int
    completed_drill_plans: int
    total_metres_drilled: float
    average_rop: float
    total_downtime_hours: float
    safety_incidents_count: int
    plans_by_status: Dict[str, int]
    drilling_progress: Dict[str, float]
    budget_utilization: float
    on_schedule_percentage: float

class DrillProgressSummary(BaseModel):
    drill_plan_id: UUID
    plan_name: str
    target_depth: float
    current_depth: float
    progress_percentage: float
    days_elapsed: int
    estimated_days_remaining: int
    average_rop: float
    budget_spent: float
    budget_remaining: float

# Drill Plans endpoints
@router.post("/drill-plans", response_model=DrillPlanResponse)
async def create_drill_plan(
    plan: DrillPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new drill plan."""
    
    await require_role(db, current_user.id, ["administrator", "drilling_manager", "geologist"])
    
    # Validate location coordinates
    validation_service = ValidationService()
    if not validation_service.validate_coordinates(plan.collar_location['coordinates']):
        raise HTTPException(status_code=400, detail="Invalid collar coordinates")
    
    db_plan = DrillPlan(
        org_id=current_user.org_id,
        **plan.dict(exclude={'collar_location'}),
        collar_location=json.dumps(plan.collar_location)
    )
    
    db.add(db_plan)
    await db.commit()
    await db.refresh(db_plan)
    
    # Convert location back to dict for response
    response_data = db_plan.__dict__.copy()
    response_data['collar_location'] = json.loads(db_plan.collar_location)
    
    return DrillPlanResponse(**response_data)

@router.get("/drill-plans", response_model=List[DrillPlanResponse])
async def list_drill_plans(
    project_id: Optional[UUID] = Query(None),
    drill_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    contractor: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List drill plans with optional filters."""
    
    query = select(DrillPlan).where(DrillPlan.org_id == current_user.org_id)
    
    if project_id:
        query = query.where(DrillPlan.project_id == project_id)
    if drill_type:
        query = query.where(DrillPlan.drill_type == drill_type)
    if status:
        query = query.where(DrillPlan.status == status)
    if contractor:
        query = query.where(DrillPlan.drilling_contractor.ilike(f"%{contractor}%"))
    if start_date:
        query = query.where(DrillPlan.planned_start_date >= start_date)
    if end_date:
        query = query.where(DrillPlan.planned_start_date <= end_date)
    
    query = query.offset(offset).limit(limit).order_by(DrillPlan.planned_start_date.desc())
    
    result = await db.execute(query)
    plans = result.scalars().all()
    
    # Convert location strings back to dicts
    response_data = []
    for plan in plans:
        plan_dict = plan.__dict__.copy()
        plan_dict['collar_location'] = json.loads(plan.collar_location)
        response_data.append(DrillPlanResponse(**plan_dict))
    
    return response_data

@router.get("/drill-plans/{plan_id}", response_model=DrillPlanResponse)
async def get_drill_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific drill plan."""
    
    result = await db.execute(
        select(DrillPlan).where(
            and_(
                DrillPlan.id == plan_id,
                DrillPlan.org_id == current_user.org_id
            )
        )
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Drill plan not found")
    
    response_data = plan.__dict__.copy()
    response_data['collar_location'] = json.loads(plan.collar_location)
    
    return DrillPlanResponse(**response_data)

@router.put("/drill-plans/{plan_id}", response_model=DrillPlanResponse)
async def update_drill_plan(
    plan_id: UUID,
    plan_update: DrillPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a drill plan."""
    
    await require_role(db, current_user.id, ["administrator", "drilling_manager"])
    
    result = await db.execute(
        select(DrillPlan).where(
            and_(
                DrillPlan.id == plan_id,
                DrillPlan.org_id == current_user.org_id
            )
        )
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Drill plan not found")
    
    # Update fields
    update_data = plan_update.dict(exclude_unset=True)
    if 'collar_location' in update_data:
        update_data['collar_location'] = json.dumps(update_data['collar_location'])
    
    for field, value in update_data.items():
        setattr(plan, field, value)
    
    plan.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(plan)
    
    response_data = plan.__dict__.copy()
    response_data['collar_location'] = json.loads(plan.collar_location)
    
    return DrillPlanResponse(**response_data)

@router.post("/drill-plans/{plan_id}/approve")
async def approve_drill_plan(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a drill plan."""
    
    await require_role(db, current_user.id, ["administrator", "drilling_manager"])
    
    result = await db.execute(
        select(DrillPlan).where(
            and_(
                DrillPlan.id == plan_id,
                DrillPlan.org_id == current_user.org_id
            )
        )
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Drill plan not found")
    
    plan.status = "approved"
    plan.approved_by = current_user.id
    plan.approved_at = datetime.utcnow()
    plan.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Drill plan approved successfully"}

# Daily Drilling Reports endpoints
@router.post("/daily-reports", response_model=DailyDrillingReportResponse)
async def create_daily_report(
    report: DailyDrillingReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new daily drilling report."""
    
    await require_role(db, current_user.id, ["administrator", "drilling_manager", "driller"])
    
    # Verify drill plan exists and belongs to org
    plan_result = await db.execute(
        select(DrillPlan).where(
            and_(
                DrillPlan.id == report.drill_plan_id,
                DrillPlan.org_id == current_user.org_id
            )
        )
    )
    drill_plan = plan_result.scalar_one_or_none()
    
    if not drill_plan:
        raise HTTPException(status_code=404, detail="Drill plan not found")
    
    # Check for duplicate report (same plan, date, shift)
    existing_result = await db.execute(
        select(DailyDrillingReport).where(
            and_(
                DailyDrillingReport.drill_plan_id == report.drill_plan_id,
                DailyDrillingReport.report_date == report.report_date,
                DailyDrillingReport.shift == report.shift
            )
        )
    )
    existing_report = existing_result.scalar_one_or_none()
    
    if existing_report:
        raise HTTPException(
            status_code=400, 
            detail=f"Daily report already exists for {report.report_date} {report.shift} shift"
        )
    
    db_report = DailyDrillingReport(
        org_id=current_user.org_id,
        project_id=drill_plan.project_id,
        country_code=drill_plan.country_code,
        data_classification=drill_plan.data_classification,
        **report.dict(exclude={'consumables_used'}),
        consumables_used=json.dumps(report.consumables_used) if report.consumables_used else None
    )
    
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    
    # Convert consumables back to dict for response
    response_data = db_report.__dict__.copy()
    response_data['consumables_used'] = json.loads(db_report.consumables_used) if db_report.consumables_used else None
    
    return DailyDrillingReportResponse(**response_data)

@router.get("/daily-reports", response_model=List[DailyDrillingReportResponse])
async def list_daily_reports(
    drill_plan_id: Optional[UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    shift: Optional[str] = Query(None),
    driller: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List daily drilling reports with optional filters."""
    
    query = select(DailyDrillingReport).where(DailyDrillingReport.org_id == current_user.org_id)
    
    if drill_plan_id:
        query = query.where(DailyDrillingReport.drill_plan_id == drill_plan_id)
    if start_date:
        query = query.where(DailyDrillingReport.report_date >= start_date)
    if end_date:
        query = query.where(DailyDrillingReport.report_date <= end_date)
    if shift:
        query = query.where(DailyDrillingReport.shift == shift)
    if driller:
        query = query.where(DailyDrillingReport.driller_name.ilike(f"%{driller}%"))
    
    query = query.offset(offset).limit(limit).order_by(DailyDrillingReport.report_date.desc())
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    # Convert consumables strings back to dicts
    response_data = []
    for report in reports:
        report_dict = report.__dict__.copy()
        report_dict['consumables_used'] = json.loads(report.consumables_used) if report.consumables_used else None
        response_data.append(DailyDrillingReportResponse(**report_dict))
    
    return response_data

@router.get("/drill-plans/{plan_id}/progress", response_model=DrillProgressSummary)
async def get_drill_progress(
    plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get drilling progress summary for a specific plan."""
    
    # Get drill plan
    plan_result = await db.execute(
        select(DrillPlan).where(
            and_(
                DrillPlan.id == plan_id,
                DrillPlan.org_id == current_user.org_id
            )
        )
    )
    plan = plan_result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Drill plan not found")
    
    # Get latest daily report for current depth
    latest_report_result = await db.execute(
        select(DailyDrillingReport)
        .where(DailyDrillingReport.drill_plan_id == plan_id)
        .order_by(desc(DailyDrillingReport.report_date), desc(DailyDrillingReport.created_at))
        .limit(1)
    )
    latest_report = latest_report_result.scalar_one_or_none()
    
    current_depth = latest_report.total_depth if latest_report else 0
    progress_percentage = (current_depth / plan.target_depth * 100) if plan.target_depth > 0 else 0
    
    # Calculate days elapsed
    start_date = plan.planned_start_date.date()
    days_elapsed = (date.today() - start_date).days
    
    # Calculate average ROP
    rop_result = await db.execute(
        select(func.avg(DailyDrillingReport.rop_average))
        .where(
            and_(
                DailyDrillingReport.drill_plan_id == plan_id,
                DailyDrillingReport.rop_average.isnot(None)
            )
        )
    )
    average_rop = float(rop_result.scalar() or 0)
    
    # Estimate remaining days
    remaining_depth = plan.target_depth - current_depth
    estimated_days_remaining = int(remaining_depth / (average_rop * 24)) if average_rop > 0 else plan.estimated_duration_days
    
    # Calculate budget spent (placeholder - would integrate with actual cost tracking)
    budget_spent = plan.budget_estimate * (progress_percentage / 100) if plan.budget_estimate else 0
    budget_remaining = (plan.budget_estimate or 0) - budget_spent
    
    return DrillProgressSummary(
        drill_plan_id=plan.id,
        plan_name=plan.plan_name,
        target_depth=plan.target_depth,
        current_depth=current_depth,
        progress_percentage=progress_percentage,
        days_elapsed=days_elapsed,
        estimated_days_remaining=estimated_days_remaining,
        average_rop=average_rop,
        budget_spent=budget_spent,
        budget_remaining=budget_remaining
    )

# Dashboard and analytics endpoints
@router.get("/dashboard", response_model=DrillerDashboardData)
async def get_driller_dashboard(
    project_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get driller dashboard data."""
    
    await require_role(db, current_user.id, ["administrator", "drilling_manager", "driller"])
    
    # Base queries
    plans_query = select(DrillPlan).where(DrillPlan.org_id == current_user.org_id)
    reports_query = select(DailyDrillingReport).where(DailyDrillingReport.org_id == current_user.org_id)
    
    if project_id:
        plans_query = plans_query.where(DrillPlan.project_id == project_id)
        reports_query = reports_query.where(DailyDrillingReport.project_id == project_id)
    
    # Active drill plans
    active_plans_result = await db.execute(
        plans_query.where(DrillPlan.status.in_(['approved', 'active', 'drilling']))
        .with_only_columns([func.count(DrillPlan.id)])
    )
    active_drill_plans = active_plans_result.scalar() or 0
    
    # Completed drill plans
    completed_plans_result = await db.execute(
        plans_query.where(DrillPlan.status == 'completed')
        .with_only_columns([func.count(DrillPlan.id)])
    )
    completed_drill_plans = completed_plans_result.scalar() or 0
    
    # Total metres drilled
    metres_result = await db.execute(
        reports_query.with_only_columns([func.sum(DailyDrillingReport.metres_drilled)])
    )
    total_metres_drilled = float(metres_result.scalar() or 0)
    
    # Average ROP
    rop_result = await db.execute(
        reports_query.where(DailyDrillingReport.rop_average.isnot(None))
        .with_only_columns([func.avg(DailyDrillingReport.rop_average)])
    )
    average_rop = float(rop_result.scalar() or 0)
    
    # Total downtime
    downtime_result = await db.execute(
        reports_query.with_only_columns([func.sum(DailyDrillingReport.downtime_hours)])
    )
    total_downtime_hours = float(downtime_result.scalar() or 0)
    
    # Safety incidents
    incidents_result = await db.execute(
        reports_query.with_only_columns([func.sum(DailyDrillingReport.safety_incidents)])
    )
    safety_incidents_count = int(incidents_result.scalar() or 0)
    
    # Plans by status
    status_result = await db.execute(
        select(
            DrillPlan.status,
            func.count(DrillPlan.id).label('count')
        ).where(DrillPlan.org_id == current_user.org_id)
        .group_by(DrillPlan.status)
    )
    plans_by_status = {row.status: row.count for row in status_result}
    
    # Drilling progress (last 30 days)
    thirty_days_ago = date.today() - timedelta(days=30)
    progress_result = await db.execute(
        select(
            func.date(DailyDrillingReport.report_date).label('date'),
            func.sum(DailyDrillingReport.metres_drilled).label('metres')
        ).where(
            and_(
                DailyDrillingReport.org_id == current_user.org_id,
                DailyDrillingReport.report_date >= thirty_days_ago
            )
        ).group_by(func.date(DailyDrillingReport.report_date))
        .order_by(func.date(DailyDrillingReport.report_date))
    )
    drilling_progress = {str(row.date): float(row.metres) for row in progress_result}
    
    # Budget utilization (placeholder calculation)
    total_budget_result = await db.execute(
        plans_query.where(DrillPlan.budget_estimate.isnot(None))
        .with_only_columns([func.sum(DrillPlan.budget_estimate)])
    )
    total_budget = float(total_budget_result.scalar() or 0)
    
    # Estimate spent budget based on progress
    spent_budget = total_budget * 0.6  # Placeholder - would calculate from actual costs
    budget_utilization = (spent_budget / total_budget * 100) if total_budget > 0 else 0
    
    # On-schedule percentage (placeholder calculation)
    on_schedule_percentage = 75.0  # Would calculate from actual vs planned progress
    
    return DrillerDashboardData(
        active_drill_plans=active_drill_plans,
        completed_drill_plans=completed_drill_plans,
        total_metres_drilled=total_metres_drilled,
        average_rop=average_rop,
        total_downtime_hours=total_downtime_hours,
        safety_incidents_count=safety_incidents_count,
        plans_by_status=plans_by_status,
        drilling_progress=drilling_progress,
        budget_utilization=budget_utilization,
        on_schedule_percentage=on_schedule_percentage
    )