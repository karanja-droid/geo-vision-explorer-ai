"""Core database models for data modules"""

from sqlalchemy import Column, String, DateTime, Boolean, Text, Float, Integer, BigInteger, Date, CheckConstraint, UniqueConstraint, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
import uuid
import enum

Base = declarative_base()

class DataClassification(enum.Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"

class ExportStatus(enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ExportFormat(enum.Enum):
    CSV = "csv"
    XLSX = "xlsx"
    JSON = "json"
    GPKG = "gpkg"
    GEOJSON = "geojson"
    PDF = "pdf"
    PNG = "png"
    COG = "cog"
    MVT = "mvt"

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="organization")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), nullable=False)
    countries = Column(ARRAY(String(2)), nullable=False, default=[])
    roles = Column(ARRAY(String(50)), nullable=False, default=[])
    aoi = Column(Text)  # WKT representation
    aoi_geom = Column(Geometry('POLYGON', srid=4326))
    data_classification = Column(SQLEnum(DataClassification), default=DataClassification.INTERNAL)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('org_id', 'slug', name='unique_project_slug_per_org'),
    )
    
    # Relationships
    organization = relationship("Organization", back_populates="projects")

class DataProvenance(Base):
    __tablename__ = "data_provenance"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(255), nullable=False)
    license = Column(String(255))
    collected_at = Column(DateTime(timezone=True))
    metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Export(Base):
    __tablename__ = "exports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    module = Column(String(50), nullable=False)
    format = Column(SQLEnum(ExportFormat), nullable=False)
    status = Column(SQLEnum(ExportStatus), default=ExportStatus.PENDING)
    file_size_bytes = Column(BigInteger)
    s3_key = Column(String(500))
    signed_url = Column(Text)
    expires_at = Column(DateTime(timezone=True))
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

class STACCollection(Base):
    __tablename__ = "stac_collections"
    
    id = Column(String(255), primary_key=True)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    keywords = Column(ARRAY(String(100)))
    license = Column(String(255))
    extent_spatial = Column(JSONB)
    extent_temporal = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class STACItem(Base):
    __tablename__ = "stac_items"
    
    id = Column(String(255), primary_key=True)
    collection_id = Column(String(255), ForeignKey('stac_collections.id'), nullable=False)
    bbox = Column(ARRAY(Float), nullable=False)
    geometry = Column(Geometry('GEOMETRY', srid=4326))
    properties = Column(JSONB, nullable=False)
    assets = Column(JSONB, nullable=False)
    links = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    enabled = Column(Boolean, default=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
# Ex
port Jobs
class ExportJob(Base):
    __tablename__ = "export_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(255), nullable=False, unique=True)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    module = Column(String(50), nullable=False)
    report_type = Column(String(100), nullable=False)
    format = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default='pending')
    parameters = Column(JSONB, nullable=True)
    file_url = Column(Text, nullable=True)
    file_size = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

# Executive Module
class ExecutiveBudget(Base):
    __tablename__ = "executive_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    budget_type = Column(String(50), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    approved_amount = Column(Float, nullable=False)
    spent_amount = Column(Float, nullable=False, default=0)
    currency = Column(String(3), nullable=False, default='USD')
    approval_status = Column(String(20), nullable=False, default='pending')
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class ExecutiveESGSignoff(Base):
    __tablename__ = "executive_esg_signoffs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    esg_category = Column(String(50), nullable=False)
    requirement_type = Column(String(100), nullable=False)
    status = Column(String(20), nullable=False, default='pending')
    signed_off_by = Column(UUID(as_uuid=True), nullable=True)
    signed_off_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    compliance_notes = Column(Text, nullable=True)
    risk_level = Column(String(20), nullable=False, default='medium')
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

# Geologist Module Extensions
class FieldObservation(Base):
    __tablename__ = "field_observations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    observation_type = Column(String(50), nullable=False)
    location = Column(Text, nullable=False)  # GeoJSON Point
    elevation = Column(Float, nullable=True)
    description = Column(Text, nullable=False)
    lithology = Column(String(100), nullable=True)
    structure_type = Column(String(50), nullable=True)
    strike = Column(Float, nullable=True)
    dip = Column(Float, nullable=True)
    mineralization = Column(Text, nullable=True)
    alteration = Column(Text, nullable=True)
    photos = Column(JSONB, nullable=True)
    geologist = Column(String(100), nullable=False)
    observation_date = Column(DateTime(timezone=True), nullable=False)
    weather_conditions = Column(String(100), nullable=True)
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class GeologicalTarget(Base):
    __tablename__ = "geological_targets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    target_name = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=False)
    geometry = Column(Text, nullable=False)  # GeoJSON Polygon/Point
    priority = Column(String(20), nullable=False, default='medium')
    rationale = Column(Text, nullable=False)
    commodity = Column(String(50), nullable=False)
    confidence_level = Column(Float, nullable=True)
    prospectivity_score = Column(Float, nullable=True)
    status = Column(String(20), nullable=False, default='active')
    assigned_to = Column(UUID(as_uuid=True), nullable=True)
    target_date = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

# Driller Module Extensions
class DrillPlan(Base):
    __tablename__ = "drill_plans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    plan_name = Column(String(100), nullable=False)
    drill_type = Column(String(50), nullable=False)
    collar_location = Column(Text, nullable=False)  # GeoJSON Point
    azimuth = Column(Float, nullable=False)
    dip = Column(Float, nullable=False)
    target_depth = Column(Float, nullable=False)
    planned_start_date = Column(DateTime(timezone=True), nullable=False)
    estimated_duration_days = Column(Integer, nullable=False)
    budget_estimate = Column(Float, nullable=True)
    currency = Column(String(3), nullable=False, default='USD')
    drilling_contractor = Column(String(100), nullable=True)
    rig_type = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default='planned')
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class DailyDrillingReport(Base):
    __tablename__ = "daily_drilling_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), nullable=False)
    project_id = Column(UUID(as_uuid=True), nullable=False)
    country_code = Column(String(3), nullable=False)
    data_classification = Column(String(20), nullable=False, default='internal')
    drill_plan_id = Column(UUID(as_uuid=True), ForeignKey('drill_plans.id', ondelete='CASCADE'), nullable=False)
    report_date = Column(Date, nullable=False)
    shift = Column(String(20), nullable=False)
    metres_drilled = Column(Float, nullable=False, default=0)
    total_depth = Column(Float, nullable=False)
    core_recovery_percent = Column(Float, nullable=True)
    drilling_fluid = Column(String(50), nullable=True)
    downtime_hours = Column(Float, nullable=False, default=0)
    downtime_reason = Column(Text, nullable=True)
    rop_average = Column(Float, nullable=True)
    consumables_used = Column(JSONB, nullable=True)
    safety_incidents = Column(Integer, nullable=False, default=0)
    weather_conditions = Column(String(100), nullable=True)
    crew_notes = Column(Text, nullable=True)
    driller_name = Column(String(100), nullable=False)
    source = Column(String(100), nullable=True)
    license = Column(String(100), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('drill_plan_id', 'report_date', 'shift', name='uq_daily_drilling_plan_date_shift'),
    )