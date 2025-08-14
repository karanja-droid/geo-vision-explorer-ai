"""Core Pydantic schemas for API validation"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date
from uuid import UUID
from enum import Enum

class DataClassification(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"

class ExportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ExportFormat(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    JSON = "json"
    GPKG = "gpkg"
    GEOJSON = "geojson"
    PDF = "pdf"
    PNG = "png"
    COG = "cog"
    MVT = "mvt"

# Base schemas
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True
        use_enum_values = True

class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None

# Organization schemas
class OrganizationBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, regex=r'^[a-z0-9-]+$')

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=100, regex=r'^[a-z0-9-]+$')

class Organization(OrganizationBase, TimestampMixin):
    id: UUID

# Project schemas
class ProjectBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, regex=r'^[a-z0-9-]+$')
    countries: List[str] = Field(default=[], description="List of ISO 3166-1 alpha-2 country codes")
    roles: List[str] = Field(default=[], description="List of user roles for this project")
    aoi: Optional[str] = Field(None, description="Area of Interest as WKT POLYGON")
    data_classification: DataClassification = DataClassification.INTERNAL

    @validator('countries')
    def validate_countries(cls, v):
        if v:
            for country in v:
                if len(country) != 2 or not country.isupper():
                    raise ValueError(f"Invalid country code: {country}. Must be ISO 3166-1 alpha-2 format.")
        return v

    @validator('aoi')
    def validate_aoi(cls, v):
        if v and not v.upper().startswith('POLYGON'):
            raise ValueError("AOI must be a valid WKT POLYGON")
        return v

class ProjectCreate(ProjectBase):
    org_id: UUID

class ProjectUpdate(BaseSchema):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=100, regex=r'^[a-z0-9-]+$')
    countries: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    aoi: Optional[str] = None
    data_classification: Optional[DataClassification] = None

class Project(ProjectBase, TimestampMixin):
    id: UUID
    org_id: UUID

# Data Provenance schemas
class DataProvenanceBase(BaseSchema):
    source: str = Field(..., min_length=1, max_length=255)
    license: Optional[str] = Field(None, max_length=255)
    collected_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class DataProvenanceCreate(DataProvenanceBase):
    pass

class DataProvenance(DataProvenanceBase, TimestampMixin):
    id: UUID

# Export schemas
class ExportBase(BaseSchema):
    module: str = Field(..., min_length=1, max_length=50)
    format: ExportFormat

class ExportCreate(ExportBase):
    org_id: UUID
    project_id: UUID

class Export(ExportBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    status: ExportStatus
    file_size_bytes: Optional[int] = None
    s3_key: Optional[str] = None
    signed_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None

# STAC schemas
class STACExtent(BaseSchema):
    spatial: Dict[str, Any]
    temporal: Dict[str, Any]

class STACCollectionBase(BaseSchema):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    license: Optional[str] = None
    extent_spatial: Optional[Dict[str, Any]] = None
    extent_temporal: Optional[Dict[str, Any]] = None

class STACCollectionCreate(STACCollectionBase):
    id: str = Field(..., min_length=1, max_length=255)
    org_id: UUID
    project_id: UUID

class STACCollection(STACCollectionBase, TimestampMixin):
    id: str
    org_id: UUID
    project_id: UUID

class STACItemBase(BaseSchema):
    bbox: List[float] = Field(..., min_items=4, max_items=4)
    properties: Dict[str, Any]
    assets: Dict[str, Any]
    links: Optional[Dict[str, Any]] = None

class STACItemCreate(STACItemBase):
    id: str = Field(..., min_length=1, max_length=255)
    collection_id: str
    geometry: Optional[Dict[str, Any]] = None

class STACItem(STACItemBase, TimestampMixin):
    id: str
    collection_id: str

# Feature Flag schemas
class FeatureFlagBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=100, regex=r'^FEATURE_[A-Z_]+$')
    enabled: bool = False
    description: Optional[str] = None

class FeatureFlagCreate(FeatureFlagBase):
    pass

class FeatureFlagUpdate(BaseSchema):
    enabled: Optional[bool] = None
    description: Optional[str] = None

class FeatureFlag(FeatureFlagBase, TimestampMixin):
    id: UUID

# Common response schemas
class SuccessResponse(BaseSchema):
    success: bool = True
    message: str
    data: Optional[Any] = None

class ErrorResponse(BaseSchema):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None

class PaginatedResponse(BaseSchema):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int

# Validation schemas
class GeometryValidation(BaseSchema):
    is_valid: bool
    error_message: Optional[str] = None
    fixed_geometry: Optional[str] = None

class CRSValidation(BaseSchema):
    is_valid: bool
    source_crs: Optional[str] = None
    target_crs: str = "EPSG:4326"
    transformed_geometry: Optional[str] = None