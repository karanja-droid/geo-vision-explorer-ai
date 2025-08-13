"""Feature Store Models

SQLAlchemy models for the feature store service including multi-scale grid cells
and computed features for geological analysis.
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from uuid import uuid4

from app.database import Base


class FSCell(Base):
    """Multi-scale grid cells for feature computation
    
    Each cell represents a spatial unit at a specific scale (1km, 3km, 5km)
    where geological features are computed and stored.
    """
    __tablename__ = 'fs_cells'
    
    cell_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    geom = Column(Geometry('POINT', srid=4326), nullable=False, index=True)
    country = Column(String, nullable=False, index=True)
    province = Column(String)
    scale = Column(Integer, nullable=False, index=True)  # 1, 3, 5 km
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy and access control
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), index=True)
    data_classification = Column(String, default='internal')
    
    # Relationships
    features = relationship("FSFeature", back_populates="cell", cascade="all, delete-orphan")
    organization = relationship("Organization", back_populates="fs_cells")
    project = relationship("Project", back_populates="fs_cells")
    
    def __repr__(self):
        return f"<FSCell(cell_id={self.cell_id}, country={self.country}, scale={self.scale})>"


class FSFeature(Base):
    """Feature values for each grid cell
    
    Stores computed geological features like distance to faults, statistical
    measures of geophysical data, morphometry, and geological classifications.
    """
    __tablename__ = 'fs_features'
    
    cell_id = Column(UUID(as_uuid=True), ForeignKey('fs_cells.cell_id', ondelete='CASCADE'), primary_key=True)
    feature_key = Column(String, primary_key=True, index=True)
    feature_val = Column(Float, nullable=False)
    
    # Relationships
    cell = relationship("FSCell", back_populates="features")
    
    def __repr__(self):
        return f"<FSFeature(cell_id={self.cell_id}, key={self.feature_key}, val={self.feature_val})>"


class Organization(Base):
    """Organization model for multi-tenancy"""
    __tablename__ = 'organizations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Enterprise features
    data_region = Column(String, default='us-west-2')
    kms_key_alias = Column(String)
    trial_ends_at = Column(DateTime(timezone=True))
    
    # Relationships
    projects = relationship("Project", back_populates="organization")
    fs_cells = relationship("FSCell", back_populates="organization")
    
    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name})>"


class Project(Base):
    """Project model for organizing geological work"""
    __tablename__ = 'projects'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'))
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    data_classification = Column(String, default='internal')
    
    # Relationships
    organization = relationship("Organization", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project")
    fs_cells = relationship("FSCell", back_populates="project")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name})>"


class ProjectMember(Base):
    """Project membership for access control"""
    __tablename__ = 'project_members'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id', ondelete='CASCADE'))
    user_id = Column(UUID(as_uuid=True), nullable=False)  # References auth.users
    role = Column(String, nullable=False, default='viewer')  # admin, analyst, viewer, external
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="members")
    
    def __repr__(self):
        return f"<ProjectMember(project_id={self.project_id}, user_id={self.user_id}, role={self.role})>"