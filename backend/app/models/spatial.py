"""Spatial data models"""

from sqlalchemy import Column, String, DateTime, Text, Float, Integer, BigInteger, Boolean, ForeignKey, UniqueConstraint, LargeBinary
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from .core import Base
import uuid

class VectorDataset(Base):
    __tablename__ = "vector_datasets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    dataset_type = Column(String(50), nullable=False)  # geology, structures, boundaries, etc.
    geometry_type = Column(String(20), nullable=False)  # POINT, LINESTRING, POLYGON, etc.
    crs = Column(String(50), nullable=False)
    feature_count = Column(Integer, default=0)
    file_format = Column(String(20))  # shapefile, geojson, gpkg, etc.
    file_size_bytes = Column(BigInteger)
    s3_key_original = Column(String(500))
    s3_key_processed = Column(String(500))
    processing_status = Column(String(20), default='pending')  # pending, processing, completed, failed
    processing_log = Column(Text)
    bbox = Column(ARRAY(Float))  # [minx, miny, maxx, maxy]
    extent_geom = Column(Geometry('POLYGON', srid=4326))
    attributes_schema = Column(JSONB)  # Schema of feature attributes
    validation_results = Column(JSONB)  # Geometry validation results
    metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    features = relationship("VectorFeature", back_populates="dataset", cascade="all, delete-orphan")
    layer_datasets = relationship("LayerDataset", back_populates="dataset")

class VectorFeature(Base):
    __tablename__ = "vector_features"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey('vector_datasets.id'), nullable=False)
    feature_id = Column(String(100))  # Original feature ID from source
    attributes = Column(JSONB, nullable=False)  # Feature attributes
    geom = Column(Geometry('GEOMETRY', srid=4326))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    dataset = relationship("VectorDataset", back_populates="features")

class VectorLayer(Base):
    __tablename__ = "vector_layers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    layer_type = Column(String(50), nullable=False)  # geology, structures, boundaries
    style_config = Column(JSONB)  # Styling configuration for maps
    visible = Column(Boolean, default=True)
    opacity = Column(Float, default=1.0)
    z_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    layer_datasets = relationship("LayerDataset", back_populates="layer")

class LayerDataset(Base):
    __tablename__ = "layer_datasets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layer_id = Column(UUID(as_uuid=True), ForeignKey('vector_layers.id'), nullable=False)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey('vector_datasets.id'), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('layer_id', 'dataset_id', name='unique_layer_dataset'),
    )
    
    # Relationships
    layer = relationship("VectorLayer", back_populates="layer_datasets")
    dataset = relationship("VectorDataset", back_populates="layer_datasets")

class VectorTilesCache(Base):
    __tablename__ = "vector_tiles_cache"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey('vector_datasets.id'), nullable=False)
    z = Column(Integer, nullable=False)  # Zoom level
    x = Column(Integer, nullable=False)  # Tile X
    y = Column(Integer, nullable=False)  # Tile Y
    tile_data = Column(LargeBinary)  # MVT tile data
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))
    
    __table_args__ = (
        UniqueConstraint('dataset_id', 'z', 'x', 'y', name='unique_tile_zxy'),
    )