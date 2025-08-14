"""Executive module API endpoints."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, Field

from ...core.database import get_db
from ...core.auth import get_current_user
from ...models.core import User
from ...core.permissions import check_permission, require_role

router = APIRouter(prefix="/executive", tags=["executive"])

# Pydantic models
class BudgetCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    budget_type: str = Field(..., max_length=50)  # exploration, development, operations
    fiscal_year: int
    approved_amount: float
    currency: str = Field(default="USD", max_length=3)
    notes: Optional[str] = None
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

class BudgetUpdate(BaseModel):
    budget_type: Optional[str] = None
    approved_amount: Optional[float] = None
    spent_amount: Optional[float] = None
    currency: Optional[str] = None
    approval_status: Optional[str] = None
    notes: Optional[str] = None

class BudgetResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    budget_type: str
    fiscal_year: int
    approved_amount: float
    spent_amount: float
    currency: str
    approval_status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

class ESGSignoffCreate(BaseModel):
    project_id: UUID
    country_code: str = Field(..., max_length=3)
    data_classification: str = Field(default="internal", max_length=20)
    esg_category: str = Field(..., max_length=50)  # environmental, social, governance
    requirement_type: str = Field(..., max_length=100)
    due_date: Optional[datetime] = None
    compliance_notes: Optional[str] = None
    risk_level: str = Field(default="medium", max_length=20)
    source: Optional[str] = None
    license: Optional[str] = None
    collected_at: Optional[datetime] = None

class ESGSignoffUpdate(BaseModel):
    esg_category: Optional[str] = None
    requirement_type: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None
    compliance_notes: Optional[str] = None
    risk_level: Optional[str] = None

class ESGSignoffResponse(BaseModel):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: str
    esg_category: str
    requirement_type: str
    status: str
    signed_off_by: Optional[UUID]
    signed_off_at: Optional[datetime]
    due_date: Optional[datetime]
    compliance_notes: Optional[str]
    risk_level: str
    created_at: datetime
    updated_at: datetime

class KPIDashboardData(BaseModel):
    total_budget: float
    spent_budget: float
    budget_utilization: float
    active_projects: int
    completed_projects: int
    pending_esg_signoffs: int
    high_risk_items: int
    cost_to_target_ratio: float
    hit_rate_percentage: float
    burn_vs_plan_percentage: float

# Budget endpoints
@router.post("/budgets", response_model=BudgetResponse)
async def create_budget(
    budget: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new budget entry."""
    
    # Check permissions
    await require_role(db, current_user.id, ["administrator", "executive"])
    
    from ...models.core import ExecutiveBudget
    
    db_budget = ExecutiveBudget(
        org_id=current_user.org_id,
        **budget.dict()
    )
    
    db.add(db_budget)
    await db.commit()
    await db.refresh(db_budget)
    
    return BudgetResponse.from_orm(db_budget)

@router.get("/budgets", response_model=List[BudgetResponse])
async def list_budgets(
    project_id: Optional[UUID] = Query(None),
    fiscal_year: Optional[int] = Query(None),
    budget_type: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List budgets with optional filters."""
    
    await require_role(db, current_user.id, ["administrator", "executive", "geologist"])
    
    from ...models.core import ExecutiveBudget
    
    query = select(ExecutiveBudget).where(ExecutiveBudget.org_id == current_user.org_id)
    
    if project_id:
        query = query.where(ExecutiveBudget.project_id == project_id)
    if fiscal_year:
        query = query.where(ExecutiveBudget.fiscal_year == fiscal_year)
    if budget_type:
        query = query.where(ExecutiveBudget.budget_type == budget_type)
    
    query = query.offset(offset).limit(limit).order_by(ExecutiveBudget.created_at.desc())
    
    result = await db.execute(query)
    budgets = result.scalars().all()
    
    return [BudgetResponse.from_orm(budget) for budget in budgets]

@router.get("/budgets/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific budget."""
    
    from ...models.core import ExecutiveBudget
    
    result = await db.execute(
        select(ExecutiveBudget).where(
            and_(
                ExecutiveBudget.id == budget_id,
                ExecutiveBudget.org_id == current_user.org_id
            )
        )
    )
    budget = result.scalar_one_or_none()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    return BudgetResponse.from_orm(budget)

@router.put("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    budget_update: BudgetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a budget."""
    
    await require_role(db, current_user.id, ["administrator", "executive"])
    
    from ...models.core import ExecutiveBudget
    
    result = await db.execute(
        select(ExecutiveBudget).where(
            and_(
                ExecutiveBudget.id == budget_id,
                ExecutiveBudget.org_id == current_user.org_id
            )
        )
    )
    budget = result.scalar_one_or_none()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Update fields
    for field, value in budget_update.dict(exclude_unset=True).items():
        setattr(budget, field, value)
    
    budget.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(budget)
    
    return BudgetResponse.from_orm(budget)

@router.post("/budgets/{budget_id}/approve")
async def approve_budget(
    budget_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve a budget."""
    
    await require_role(db, current_user.id, ["administrator", "executive"])
    
    from ...models.core import ExecutiveBudget
    
    result = await db.execute(
        select(ExecutiveBudget).where(
            and_(
                ExecutiveBudget.id == budget_id,
                ExecutiveBudget.org_id == current_user.org_id
            )
        )
    )
    budget = result.scalar_one_or_none()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    budget.approval_status = "approved"
    budget.approved_by = current_user.id
    budget.approved_at = datetime.utcnow()
    budget.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Budget approved successfully"}

# ESG Signoff endpoints
@router.post("/esg-signoffs", response_model=ESGSignoffResponse)
async def create_esg_signoff(
    signoff: ESGSignoffCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new ESG signoff requirement."""
    
    await require_role(db, current_user.id, ["administrator", "executive", "environmental_officer"])
    
    from ...models.core import ExecutiveESGSignoff
    
    db_signoff = ExecutiveESGSignoff(
        org_id=current_user.org_id,
        **signoff.dict()
    )
    
    db.add(db_signoff)
    await db.commit()
    await db.refresh(db_signoff)
    
    return ESGSignoffResponse.from_orm(db_signoff)

@router.get("/esg-signoffs", response_model=List[ESGSignoffResponse])
async def list_esg_signoffs(
    project_id: Optional[UUID] = Query(None),
    esg_category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List ESG signoffs with optional filters."""
    
    from ...models.core import ExecutiveESGSignoff
    
    query = select(ExecutiveESGSignoff).where(ExecutiveESGSignoff.org_id == current_user.org_id)
    
    if project_id:
        query = query.where(ExecutiveESGSignoff.project_id == project_id)
    if esg_category:
        query = query.where(ExecutiveESGSignoff.esg_category == esg_category)
    if status:
        query = query.where(ExecutiveESGSignoff.status == status)
    if risk_level:
        query = query.where(ExecutiveESGSignoff.risk_level == risk_level)
    
    query = query.offset(offset).limit(limit).order_by(ExecutiveESGSignoff.created_at.desc())
    
    result = await db.execute(query)
    signoffs = result.scalars().all()
    
    return [ESGSignoffResponse.from_orm(signoff) for signoff in signoffs]

@router.post("/esg-signoffs/{signoff_id}/sign-off")
async def sign_off_esg(
    signoff_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sign off on an ESG requirement."""
    
    await require_role(db, current_user.id, ["administrator", "executive", "environmental_officer"])
    
    from ...models.core import ExecutiveESGSignoff
    
    result = await db.execute(
        select(ExecutiveESGSignoff).where(
            and_(
                ExecutiveESGSignoff.id == signoff_id,
                ExecutiveESGSignoff.org_id == current_user.org_id
            )
        )
    )
    signoff = result.scalar_one_or_none()
    
    if not signoff:
        raise HTTPException(status_code=404, detail="ESG signoff not found")
    
    signoff.status = "signed_off"
    signoff.signed_off_by = current_user.id
    signoff.signed_off_at = datetime.utcnow()
    signoff.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "ESG requirement signed off successfully"}

# Dashboard and analytics endpoints
@router.get("/dashboard/kpi", response_model=KPIDashboardData)
async def get_kpi_dashboard(
    project_id: Optional[UUID] = Query(None),
    fiscal_year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get KPI dashboard data."""
    
    await require_role(db, current_user.id, ["administrator", "executive"])
    
    from ...models.core import ExecutiveBudget, ExecutiveESGSignoff, Project
    
    # Budget metrics
    budget_query = select(
        func.sum(ExecutiveBudget.approved_amount).label('total_budget'),
        func.sum(ExecutiveBudget.spent_amount).label('spent_budget')
    ).where(ExecutiveBudget.org_id == current_user.org_id)
    
    if project_id:
        budget_query = budget_query.where(ExecutiveBudget.project_id == project_id)
    if fiscal_year:
        budget_query = budget_query.where(ExecutiveBudget.fiscal_year == fiscal_year)
    
    budget_result = await db.execute(budget_query)
    budget_data = budget_result.first()
    
    total_budget = float(budget_data.total_budget or 0)
    spent_budget = float(budget_data.spent_budget or 0)
    budget_utilization = (spent_budget / total_budget * 100) if total_budget > 0 else 0
    
    # Project metrics
    project_query = select(
        func.count(Project.id).label('total_projects'),
        func.sum(func.case([(Project.status == 'completed', 1)], else_=0)).label('completed_projects')
    ).where(Project.org_id == current_user.org_id)
    
    if project_id:
        project_query = project_query.where(Project.id == project_id)
    
    project_result = await db.execute(project_query)
    project_data = project_result.first()
    
    total_projects = int(project_data.total_projects or 0)
    completed_projects = int(project_data.completed_projects or 0)
    active_projects = total_projects - completed_projects
    
    # ESG metrics
    esg_query = select(
        func.count(ExecutiveESGSignoff.id).label('pending_signoffs'),
        func.sum(func.case([(ExecutiveESGSignoff.risk_level == 'high', 1)], else_=0)).label('high_risk_items')
    ).where(
        and_(
            ExecutiveESGSignoff.org_id == current_user.org_id,
            ExecutiveESGSignoff.status == 'pending'
        )
    )
    
    if project_id:
        esg_query = esg_query.where(ExecutiveESGSignoff.project_id == project_id)
    
    esg_result = await db.execute(esg_query)
    esg_data = esg_result.first()
    
    pending_esg_signoffs = int(esg_data.pending_signoffs or 0)
    high_risk_items = int(esg_data.high_risk_items or 0)
    
    # Calculate derived metrics (placeholder calculations)
    cost_to_target_ratio = 1.2  # Would be calculated from actual targets
    hit_rate_percentage = 65.0  # Would be calculated from drilling success
    burn_vs_plan_percentage = (spent_budget / total_budget * 100) if total_budget > 0 else 0
    
    return KPIDashboardData(
        total_budget=total_budget,
        spent_budget=spent_budget,
        budget_utilization=budget_utilization,
        active_projects=active_projects,
        completed_projects=completed_projects,
        pending_esg_signoffs=pending_esg_signoffs,
        high_risk_items=high_risk_items,
        cost_to_target_ratio=cost_to_target_ratio,
        hit_rate_percentage=hit_rate_percentage,
        burn_vs_plan_percentage=burn_vs_plan_percentage
    )