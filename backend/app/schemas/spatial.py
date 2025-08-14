"""Spatial data Pydantic schemas"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from .core import BaseSchema, TimestampMixin, DataClassification

# Vector Dataset schemas
class VectorDatasetBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255, description="Dataset name")
    description: Optional[str] = None
    dataset_type: str = Field(..., max_length=50, description="Type of dataset (geology, structures, boundaries, etc.)")
    geometry_type: str = Field(..., max_length=20, description="Geometry type (POINT, LINESTRING, POLYGON, etc.)")
    crs: str = Field(..., max_length=50, description="Coordinate reference system")
    feature_count: int = Field(default=0, ge=0, description="Number of features in dataset")
    file_format: Optional[str] = Field(None, max_length=20, description="Original file format")
    file_size_bytes: Optional[int] = Field(None, ge=0, description="File size in bytes")
    processing_status: str = Field(default='pending', max_length=20, description="Processing status")
    processing_log: Optional[str] = None
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4, description="Bounding box [minx, miny, maxx, maxy]")
    attributes_schema: Optional[Dict[str, Any]] = Field(default={}, description="Schema of feature attributes")
    validation_results: Optional[Dict[str, Any]] = Field(default={}, description="Geometry validation results")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")

    @validator('dataset_type')
    def validate_dataset_type(cls, v):
        valid_types = [
            'geology', 'structures', 'boundaries', 'topography', 'infrastructure',
            'land_use', 'hydrology', 'vegetation', 'soil', 'geochemistry',
            'geophysics', 'drilling', 'mining', 'environmental'
        ]
        if v not in valid_types:
            # Allow other types but validate format
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError("Dataset type must contain only alphanumeric characters, hyphens, and underscores")
        return v

    @validator('geometry_type')
    def validate_geometry_type(cls, v):
        valid_types = [
            'POINT', 'MULTIPOINT', 'LINESTRING', 'MULTILINESTRING',
            'POLYGON', 'MULTIPOLYGON', 'GEOMETRY', 'GEOMETRYCOLLECTION'
        ]
        if v.upper() not in valid_types:
            raise ValueError(f"Invalid geometry type. Must be one of: {', '.join(valid_types)}")
        return v.upper()

    @validator('processing_status')
    def validate_processing_status(cls, v):
        valid_statuses = ['pending', 'processing', 'completed', 'failed', 'validation_failed']
        if v not in valid_statuses:
            raise ValueError(f"Invalid processing status. Must be one of: {', '.join(valid_statuses)}")
        return v

    @validator('bbox')
    def validate_bbox(cls, v):
        if v and len(v) == 4:
            minx, miny, maxx, maxy = v
            if minx >= maxx or miny >= maxy:
                raise ValueError("Invalid bounding box: min values must be less than max values")
            if not (-180 <= minx <= 180 and -180 <= maxx <= 180):
                raise ValueError("Longitude values must be between -180 and 180")
            if not (-90 <= miny <= 90 and -90 <= maxy <= 90):
                raise ValueError("Latitude values must be between -90 and 90")
        return v

class VectorDatasetCreate(VectorDatasetBase):
    org_id: UUID
    project_id: UUID
    country_code: str = Field(..., min_length=2, max_length=2)
    data_classification: DataClassification = DataClassification.INTERNAL
    provenance_id: Optional[UUID] = None

class VectorDatasetUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    dataset_type: Optional[str] = Field(None, max_length=50)
    processing_status: Optional[str] = Field(None, max_length=20)
    processing_log: Optional[str] = None
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4)
    attributes_schema: Optional[Dict[str, Any]] = None
    validation_results: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

class VectorDataset(VectorDatasetBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: DataClassification
    provenance_id: Optional[UUID] = None
    s3_key_original: Optional[str] = None
    s3_key_processed: Optional[str] = None

# Vector Feature schemas
class VectorFeatureBase(BaseSchema):
    feature_id: Optional[str] = Field(None, max_length=100, description="Original feature ID from source")
    attributes: Dict[str, Any] = Field(..., description="Feature attributes")

class VectorFeatureCreate(VectorFeatureBase):
    dataset_id: UUID
    geometry_wkt: Optional[str] = Field(None, description="Geometry as WKT string")

class VectorFeature(VectorFeatureBase, TimestampMixin):
    id: UUID
    dataset_id: UUID

# Vector Layer schemas
class VectorLayerBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255, description="Layer name")
    description: Optional[str] = None
    layer_type: str = Field(..., max_length=50, description="Type of layer")
    style_config: Optional[Dict[str, Any]] = Field(default={}, description="Styling configuration")
    visible: bool = Field(default=True, description="Layer visibility")
    opacity: float = Field(default=1.0, ge=0.0, le=1.0, description="Layer opacity")
    z_index: int = Field(default=0, description="Layer z-index for ordering")

    @validator('layer_type')
    def validate_layer_type(cls, v):
        valid_types = [
            'geology', 'structures', 'boundaries', 'topography', 'infrastructure',
            'land_use', 'hydrology', 'vegetation', 'base_map', 'overlay'
        ]
        if v not in valid_types:
            # Allow other types but validate format
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError("Layer type must contain only alphanumeric characters, hyphens, and underscores")
        return v

class VectorLayerCreate(VectorLayerBase):
    org_id: UUID
    project_id: UUID

class VectorLayerUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    layer_type: Optional[str] = Field(None, max_length=50)
    style_config: Optional[Dict[str, Any]] = None
    visible: Optional[bool] = None
    opacity: Optional[float] = Field(None, ge=0.0, le=1.0)
    z_index: Optional[int] = None

class VectorLayer(VectorLayerBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID

# File upload schemas
class VectorFileUploadRequest(BaseSchema):
    dataset_name: str = Field(..., min_length=1, max_length=255)
    dataset_type: str = Field(..., max_length=50)
    description: Optional[str] = None
    crs: Optional[str] = Field(None, description="Override CRS if not detected correctly")

class VectorFileUploadResult(BaseSchema):
    dataset_id: UUID
    processing_result: Dict[str, Any]
    message: str

# Validation schemas
class GeometryValidationRequest(BaseSchema):
    fix_invalid: bool = Field(default=False, description="Automatically fix invalid geometries")

class GeometryValidationResult(BaseSchema):
    dataset_id: UUID
    validation_result: Dict[str, Any]
    message: str

class GeometryOptimizationRequest(BaseSchema):
    simplify_tolerance: Optional[float] = Field(None, ge=0, description="Simplification tolerance in map units")

class GeometryOptimizationResult(BaseSchema):
    dataset_id: UUID
    optimization_result: Dict[str, Any]
    message: str

# Tile schemas
class TileJSONSpec(BaseSchema):
    tilejson: str = "3.0.0"
    name: str
    description: Optional[str] = None
    version: str = "1.0.0"
    attribution: str = "GeoVision AI Miner"
    scheme: str = "xyz"
    tiles: List[str]
    minzoom: int = 0
    maxzoom: int = 14
    bounds: List[float]
    center: List[float]
    vector_layers: List[Dict[str, Any]]

# Statistics schemas
class VectorStatistics(BaseSchema):
    datasets: Dict[str, Any]
    features: Dict[str, Any]

# Layer management schemas
class LayerDatasetAssignment(BaseSchema):
    layer_id: UUID
    dataset_id: UUID
    order_index: int = Field(default=0, description="Order within the layer")

# Export schemas
class VectorExportRequest(BaseSchema):
    format: str = Field(..., description="Export format (geojson, shapefile, gpkg, kml, csv)")
    dataset_ids: Optional[List[UUID]] = Field(None, description="Specific datasets to export")
    layer_ids: Optional[List[UUID]] = Field(None, description="Specific layers to export")
    bbox: Optional[str] = Field(None, description="Bounding box filter as 'minx,miny,maxx,maxy'")
    crs: Optional[str] = Field(None, description="Target CRS for export")

    @validator('format')
    def validate_export_format(cls, v):
        valid_formats = ['geojson', 'shapefile', 'gpkg', 'kml', 'csv', 'xlsx']
        if v not in valid_formats:
            raise ValueError(f"Invalid export format. Must be one of: {', '.join(valid_formats)}")
        return v

# Feature query schemas
class FeatureQueryRequest(BaseSchema):
    bbox: Optional[str] = Field(None, description="Bounding box as 'minx,miny,maxx,maxy'")
    attributes_filter: Optional[Dict[str, Any]] = Field(None, description="Filter by attributes")
    geometry_filter: Optional[str] = Field(None, description="Spatial filter geometry as WKT")
    limit: int = Field(default=1000, ge=1, le=10000, description="Maximum number of features to return")

class FeatureQueryResult(BaseSchema):
    features: List[VectorFeature]
    total_count: int
    bbox: Optional[List[float]] = None