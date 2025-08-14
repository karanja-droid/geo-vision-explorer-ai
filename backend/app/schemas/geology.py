"""Geology and remote sensing Pydantic schemas"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from .core import BaseSchema, TimestampMixin, DataClassification

# Remote Sensing schemas
class RemoteSensingBase(BaseSchema):
    satellite: str = Field(..., min_length=1, max_length=50, description="Satellite platform (e.g., Sentinel-2, Landsat-8)")
    scene_id: str = Field(..., min_length=1, max_length=100, description="Unique scene identifier")
    acquisition_date: date = Field(..., description="Date when the scene was acquired")
    cloud_cover_percent: Optional[float] = Field(None, ge=0, le=100, description="Cloud cover percentage")
    season: Optional[str] = Field(None, max_length=20, description="Season when acquired (wet, dry, spring, etc.)")
    processing_level: Optional[str] = Field(None, max_length=10, description="Processing level (L1C, L2A, etc.)")
    bands_available: Optional[List[str]] = Field(default=[], description="Available spectral bands")
    indices_computed: Optional[List[str]] = Field(default=[], description="Computed spectral indices")
    s3_key_composite: Optional[str] = Field(None, max_length=500, description="S3 key for composite image")
    s3_key_indices: Optional[str] = Field(None, max_length=500, description="S3 key for indices image")
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4, description="Bounding box [minx, miny, maxx, maxy]")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")

    @validator('satellite')
    def validate_satellite(cls, v):
        supported_satellites = ['Sentinel-2', 'Landsat-8', 'Landsat-9', 'ASTER', 'WorldView', 'SPOT', 'RapidEye']
        if v not in supported_satellites:
            # Allow other satellites but warn
            pass
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

    @validator('indices_computed')
    def validate_indices(cls, v):
        if v:
            valid_indices = ['NDVI', 'NDWI', 'NBR', 'ferric', 'ferrous', 'clay', 'carbonate', 'SAVI', 'EVI']
            for index in v:
                if index not in valid_indices:
                    raise ValueError(f"Unsupported spectral index: {index}")
        return v

class RemoteSensingCreate(RemoteSensingBase):
    org_id: UUID
    project_id: UUID
    country_code: str = Field(..., min_length=2, max_length=2)
    data_classification: DataClassification = DataClassification.INTERNAL
    provenance_id: Optional[UUID] = None

class RemoteSensingUpdate(BaseSchema):
    satellite: Optional[str] = Field(None, min_length=1, max_length=50)
    scene_id: Optional[str] = Field(None, min_length=1, max_length=100)
    acquisition_date: Optional[date] = None
    cloud_cover_percent: Optional[float] = Field(None, ge=0, le=100)
    season: Optional[str] = Field(None, max_length=20)
    processing_level: Optional[str] = Field(None, max_length=10)
    bands_available: Optional[List[str]] = None
    indices_computed: Optional[List[str]] = None
    s3_key_composite: Optional[str] = Field(None, max_length=500)
    s3_key_indices: Optional[str] = Field(None, max_length=500)
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4)
    metadata: Optional[Dict[str, Any]] = None

class RemoteSensing(RemoteSensingBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: DataClassification
    provenance_id: Optional[UUID] = None

# Raster Asset schemas
class RasterAssetBase(BaseSchema):
    asset_type: str = Field(..., max_length=50, description="Type of raster asset (mag, gravity, dem, etc.)")
    name: str = Field(..., min_length=1, max_length=255, description="Asset name")
    description: Optional[str] = None
    crs: str = Field(..., max_length=50, description="Coordinate reference system")
    pixel_size_x: Optional[float] = Field(None, gt=0, description="Pixel size in X direction")
    pixel_size_y: Optional[float] = Field(None, gt=0, description="Pixel size in Y direction")
    nodata_value: Optional[float] = Field(None, description="No data value")
    units: Optional[str] = Field(None, max_length=50, description="Data units")
    s3_key: str = Field(..., max_length=500, description="S3 key for raster file")
    cog_optimized: bool = Field(default=False, description="Whether file is COG optimized")
    overviews_built: bool = Field(default=False, description="Whether overviews are built")
    file_size_bytes: Optional[int] = Field(None, ge=0, description="File size in bytes")
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4, description="Bounding box")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Additional metadata")

    @validator('asset_type')
    def validate_asset_type(cls, v):
        valid_types = [
            'mag', 'gravity', 'radiometric', 'dem', 'slope', 'aspect', 'hillshade',
            'geology', 'geophysics', 'geochemistry', 'landsat', 'sentinel', 'aster'
        ]
        if v not in valid_types:
            # Allow other types but validate format
            if not v.replace('_', '').replace('-', '').isalnum():
                raise ValueError("Asset type must contain only alphanumeric characters, hyphens, and underscores")
        return v

    @validator('crs')
    def validate_crs(cls, v):
        # Basic CRS validation
        if not (v.startswith('EPSG:') or v.startswith('PROJ:') or v.startswith('WKT:')):
            raise ValueError("CRS must be in EPSG:, PROJ:, or WKT: format")
        return v

class RasterAssetCreate(RasterAssetBase):
    org_id: UUID
    project_id: UUID
    country_code: str = Field(..., min_length=2, max_length=2)
    data_classification: DataClassification = DataClassification.INTERNAL
    provenance_id: Optional[UUID] = None

class RasterAssetUpdate(BaseSchema):
    asset_type: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    crs: Optional[str] = Field(None, max_length=50)
    pixel_size_x: Optional[float] = Field(None, gt=0)
    pixel_size_y: Optional[float] = Field(None, gt=0)
    nodata_value: Optional[float] = None
    units: Optional[str] = Field(None, max_length=50)
    cog_optimized: Optional[bool] = None
    overviews_built: Optional[bool] = None
    file_size_bytes: Optional[int] = Field(None, ge=0)
    bbox: Optional[List[float]] = Field(None, min_items=4, max_items=4)
    metadata: Optional[Dict[str, Any]] = None

class RasterAsset(RasterAssetBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: DataClassification
    provenance_id: Optional[UUID] = None

# Spectral Index schemas
class SpectralIndexRequest(BaseSchema):
    indices: List[str] = Field(..., min_items=1, description="List of indices to calculate")
    output_format: str = Field(default="cog", description="Output format (cog, geotiff)")
    
    @validator('indices')
    def validate_indices_list(cls, v):
        valid_indices = ['NDVI', 'NDWI', 'NBR', 'ferric', 'ferrous', 'clay', 'carbonate', 'SAVI', 'EVI']
        for index in v:
            if index not in valid_indices:
                raise ValueError(f"Unsupported spectral index: {index}")
        return v

class SpectralIndexResult(BaseSchema):
    scene_id: UUID
    indices_calculated: List[str]
    s3_key_indices: str
    processing_time_seconds: float
    metadata: Dict[str, Any]

# Scene upload schemas
class SceneUploadRequest(BaseSchema):
    satellite: str = Field(..., description="Satellite platform")
    scene_id: str = Field(..., description="Scene identifier")
    acquisition_date: date = Field(..., description="Acquisition date")
    cloud_cover_percent: Optional[float] = Field(None, ge=0, le=100)
    processing_level: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class SceneUploadResult(BaseSchema):
    scene_id: UUID
    processing_result: Dict[str, Any]
    s3_keys: Dict[str, str]
    message: str

# Quicklook schemas
class QuicklookRequest(BaseSchema):
    bands: List[str] = Field(default=["red", "green", "blue"], description="Bands for RGB composite")
    max_size: int = Field(default=1024, ge=256, le=2048, description="Maximum image size in pixels")
    format: str = Field(default="png", description="Output format (png, jpeg)")

class QuicklookResult(BaseSchema):
    scene_id: UUID
    quicklook_url: str
    size: List[int]  # [width, height]
    bands_used: List[str]
    expires_at: datetime

# Statistics schemas
class RemoteSensingStatistics(BaseSchema):
    scenes: Dict[str, Any]
    cloud_cover: Dict[str, Any]
    temporal: Dict[str, Any]
    satellites: Dict[str, int]
    indices: Dict[str, int]

# Satellite information schemas
class SatelliteInfo(BaseSchema):
    name: str
    description: str
    bands: List[str]
    resolution: str
    revisit_time: str
    spectral_ranges: Optional[Dict[str, str]] = None

class SpectralIndexInfo(BaseSchema):
    name: str
    formula: str
    description: str
    range: List[float]
    applications: List[str]