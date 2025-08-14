"""Project and Organization API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.core import Organization, Project
from app.schemas.core import (
    Organization as OrganizationSchema,
    OrganizationCreate,
    OrganizationUpdate,
    Project as ProjectSchema,
    ProjectCreate,
    ProjectUpdate,
    SuccessResponse,
    PaginatedResponse
)
from app.services.validation import validate_geometry, validate_crs
from app.services.stac import create_project_collection
from app.core.security import get_current_user

router = APIRouter()

# Organization endpoints
@router.post("/organizations", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new organization"""
    
    # Check if slug already exists
    existing_org = db.query(Organization).filter(Organization.slug == org_data.slug).first()
    if existing_org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with slug '{org_data.slug}' already exists"
        )
    
    # Create organization
    org = Organization(**org_data.dict())
    db.add(org)
    db.commit()
    db.refresh(org)
    
    return org

@router.get("/organizations", response_model=List[OrganizationSchema])
async def list_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List organizations"""
    
    organizations = db.query(Organization).offset(skip).limit(limit).all()
    return organizations

@router.get("/organizations/{org_id}", response_model=OrganizationSchema)
async def get_organization(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get organization by ID"""
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return org

@router.put("/organizations/{org_id}", response_model=OrganizationSchema)
async def update_organization(
    org_id: UUID,
    org_data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update organization"""
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check slug uniqueness if being updated
    if org_data.slug and org_data.slug != org.slug:
        existing_org = db.query(Organization).filter(Organization.slug == org_data.slug).first()
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization with slug '{org_data.slug}' already exists"
            )
    
    # Update fields
    update_data = org_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)
    
    db.commit()
    db.refresh(org)
    
    return org

@router.delete("/organizations/{org_id}", response_model=SuccessResponse)
async def delete_organization(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete organization"""
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check if organization has projects
    project_count = db.query(Project).filter(Project.org_id == org_id).count()
    if project_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete organization with {project_count} projects. Delete projects first."
        )
    
    db.delete(org)
    db.commit()
    
    return SuccessResponse(message="Organization deleted successfully")

# Project endpoints
@router.post("/projects", response_model=ProjectSchema, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Create a new project"""
    
    # Verify organization exists
    org = db.query(Organization).filter(Organization.id == project_data.org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check if slug already exists within organization
    existing_project = db.query(Project).filter(
        Project.org_id == project_data.org_id,
        Project.slug == project_data.slug
    ).first()
    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with slug '{project_data.slug}' already exists in this organization"
        )
    
    # Validate AOI geometry if provided
    if project_data.aoi:
        validation = validate_geometry(project_data.aoi)
        if not validation.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid AOI geometry: {validation.error_message}"
            )
    
    # Create project
    project_dict = project_data.dict()
    project = Project(**project_dict)
    
    # Set geometry from WKT if provided
    if project_data.aoi:
        project.aoi_geom = f"SRID=4326;{project_data.aoi}"
    
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Create STAC collection for project
    try:
        await create_project_collection(db, project)
    except Exception as e:
        # Log error but don't fail project creation
        print(f"Failed to create STAC collection for project {project.id}: {e}")
    
    return project

@router.get("/projects", response_model=List[ProjectSchema])
async def list_projects(
    org_id: Optional[UUID] = Query(None),
    country: Optional[str] = Query(None, max_length=2),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List projects with optional filtering"""
    
    query = db.query(Project)
    
    if org_id:
        query = query.filter(Project.org_id == org_id)
    
    if country:
        query = query.filter(Project.countries.contains([country.upper()]))
    
    projects = query.offset(skip).limit(limit).all()
    return projects

@router.get("/projects/{project_id}", response_model=ProjectSchema)
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get project by ID"""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project

@router.put("/projects/{project_id}", response_model=ProjectSchema)
async def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update project"""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check slug uniqueness if being updated
    if project_data.slug and project_data.slug != project.slug:
        existing_project = db.query(Project).filter(
            Project.org_id == project.org_id,
            Project.slug == project_data.slug
        ).first()
        if existing_project:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project with slug '{project_data.slug}' already exists in this organization"
            )
    
    # Validate AOI geometry if being updated
    if project_data.aoi:
        validation = validate_geometry(project_data.aoi)
        if not validation.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid AOI geometry: {validation.error_message}"
            )
    
    # Update fields
    update_data = project_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == 'aoi' and value:
            setattr(project, field, value)
            project.aoi_geom = f"SRID=4326;{value}"
        else:
            setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    
    return project

@router.delete("/projects/{project_id}", response_model=SuccessResponse)
async def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete project"""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # TODO: Check if project has associated data and handle cleanup
    
    db.delete(project)
    db.commit()
    
    return SuccessResponse(message="Project deleted successfully")

@router.post("/projects/{project_id}/validate-aoi")
async def validate_project_aoi(
    project_id: UUID,
    aoi_wkt: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Validate AOI geometry for a project"""
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    validation = validate_geometry(aoi_wkt)
    return validation