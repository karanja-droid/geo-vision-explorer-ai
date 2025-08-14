"""Geology and spatial data models"""

from sqlalchemy import Column, String, DateTime, Text, Float, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from .core import Base, DataClassification
import uuid

# Base class for country-specific geology tables
class GeologyBase:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# Dynamic geology tables will be created for each country
# Example: geology_au, geology_ca, etc.

class RasterAsset(Base):
    __tablename__ = "raster_assets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    asset_type = Column(String(50), nullable=False)  # mag, gravity, radiometric, dem, slope
    name = Column(String(255), nullable=False)
    description = Column(Text)
    crs = Column(String(50), nullable=False)
    pixel_size_x = Column(Float)
    pixel_size_y = Column(Float)
    nodata_value = Column(Float)
    units = Column(String(50))
    s3_key = Column(String(500), nullable=False)
    cog_optimized = Column(String(10), default='false')
    overviews_built = Column(String(10), default='false')
    file_size_bytes = Column(String(20))
    bbox = Column(JSONB)  # [minx, miny, maxx, maxy]
    footprint = Column(Geometry('POLYGON', srid=4326))
    metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RemoteSensing(Base):
    __tablename__ = "remote_sensing"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    satellite = Column(String(50), nullable=False)  # Sentinel-2, Landsat-8, etc.
    scene_id = Column(String(100), nullable=False)
    acquisition_date = Column(String(20), nullable=False)
    cloud_cover_percent = Column(Float)
    season = Column(String(20))  # wet, dry, spring, summer
    processing_level = Column(String(10))  # L1C, L2A
    bands_available = Column(JSONB)
    indices_computed = Column(JSONB)  # NDVI, NDWI, NBR, etc.
    s3_key_composite = Column(String(500))
    s3_key_indices = Column(String(500))
    bbox = Column(JSONB)
    footprint = Column(Geometry('POLYGON', srid=4326))
    metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())