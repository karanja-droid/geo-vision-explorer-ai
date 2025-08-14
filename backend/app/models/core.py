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