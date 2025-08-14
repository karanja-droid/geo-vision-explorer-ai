"""Drilling and geochemistry Pydantic schemas"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID
from .core import BaseSchema, TimestampMixin, DataClassification

# Drill Collar schemas
class DrillCollarBase(BaseSchema):
    hole_id: str = Field(..., min_length=1, max_length=50)
    easting: float = Field(..., description="Easting coordinate")
    northing: float = Field(..., description="Northing coordinate")
    elevation: float = Field(..., description="Elevation in meters")
    total_depth: float = Field(..., gt=0, description="Total depth in meters")
    azimuth: Optional[float] = Field(None, ge=0, le=360, description="Azimuth in degrees")
    dip: Optional[float] = Field(None, ge=-90, le=90, description="Dip in degrees")
    drill_date: Optional[date] = None
    drill_type: Optional[str] = Field(None, max_length=50, description="RC, DD, RAB, etc.")
    contractor: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field("planned", max_length=20, description="planned, drilling, completed, abandoned")
    attributes: Optional[Dict[str, Any]] = None

class DrillCollarCreate(DrillCollarBase):
    org_id: UUID
    project_id: UUID
    country_code: str = Field(..., min_length=2, max_length=2)
    data_classification: DataClassification = DataClassification.INTERNAL
    provenance_id: Optional[UUID] = None

class DrillCollarUpdate(BaseSchema):
    hole_id: Optional[str] = Field(None, min_length=1, max_length=50)
    easting: Optional[float] = None
    northing: Optional[float] = None
    elevation: Optional[float] = None
    total_depth: Optional[float] = Field(None, gt=0)
    azimuth: Optional[float] = Field(None, ge=0, le=360)
    dip: Optional[float] = Field(None, ge=-90, le=90)
    drill_date: Optional[date] = None
    drill_type: Optional[str] = Field(None, max_length=50)
    contractor: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=20)
    attributes: Optional[Dict[str, Any]] = None

class DrillCollar(DrillCollarBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: DataClassification
    provenance_id: Optional[UUID] = None

# Drill Survey schemas
class DrillSurveyBase(BaseSchema):
    depth_m: float = Field(..., ge=0, description="Depth in meters")
    azimuth: float = Field(..., ge=0, le=360, description="Azimuth in degrees")
    dip: float = Field(..., ge=-90, le=90, description="Dip in degrees")
    survey_method: Optional[str] = Field(None, max_length=50)

class DrillSurveyCreate(DrillSurveyBase):
    collar_id: UUID

class DrillSurvey(DrillSurveyBase, TimestampMixin):
    id: UUID
    collar_id: UUID

# Drill Interval schemas
class DrillIntervalBase(BaseSchema):
    from_m: float = Field(..., ge=0, description="From depth in meters")
    to_m: float = Field(..., gt=0, description="To depth in meters")
    lithology: Optional[str] = Field(None, max_length=100)
    alteration: Optional[str] = Field(None, max_length=100)
    mineralization: Optional[str] = Field(None, max_length=100)
    recovery_percent: Optional[float] = Field(None, ge=0, le=100)
    rqd_percent: Optional[float] = Field(None, ge=0, le=100, description="Rock Quality Designation")
    description: Optional[str] = None
    geologist: Optional[str] = Field(None, max_length=100)
    logged_date: Optional[date] = None
    attributes: Optional[Dict[str, Any]] = None

    @validator('to_m')
    def validate_interval(cls, v, values):
        if 'from_m' in values and v <= values['from_m']:
            raise ValueError('to_m must be greater than from_m')
        return v

class DrillIntervalCreate(DrillIntervalBase):
    collar_id: UUID

class DrillIntervalUpdate(BaseSchema):
    from_m: Optional[float] = Field(None, ge=0)
    to_m: Optional[float] = Field(None, gt=0)
    lithology: Optional[str] = Field(None, max_length=100)
    alteration: Optional[str] = Field(None, max_length=100)
    mineralization: Optional[str] = Field(None, max_length=100)
    recovery_percent: Optional[float] = Field(None, ge=0, le=100)
    rqd_percent: Optional[float] = Field(None, ge=0, le=100)
    description: Optional[str] = None
    geologist: Optional[str] = Field(None, max_length=100)
    logged_date: Optional[date] = None
    attributes: Optional[Dict[str, Any]] = None

class DrillInterval(DrillIntervalBase, TimestampMixin):
    id: UUID
    collar_id: UUID

# Drill Assay schemas
class ElementResult(BaseSchema):
    value: Optional[float] = None
    unit: str = Field(..., max_length=20)
    detection_limit: Optional[float] = None
    qualifier: Optional[str] = Field(None, max_length=10, description="<, >, etc.")

class DrillAssayBase(BaseSchema):
    from_m: float = Field(..., ge=0, description="From depth in meters")
    to_m: float = Field(..., gt=0, description="To depth in meters")
    sample_id: Optional[str] = Field(None, max_length=50)
    batch_id: Optional[str] = Field(None, max_length=50)
    lab: Optional[str] = Field(None, max_length=100)
    assay_date: Optional[date] = None
    elements: Dict[str, ElementResult] = Field(..., description="Element results")
    qc_flags: Optional[Dict[str, Any]] = None

    @validator('to_m')
    def validate_assay_interval(cls, v, values):
        if 'from_m' in values and v <= values['from_m']:
            raise ValueError('to_m must be greater than from_m')
        return v

class DrillAssayCreate(DrillAssayBase):
    collar_id: UUID

class DrillAssayUpdate(BaseSchema):
    from_m: Optional[float] = Field(None, ge=0)
    to_m: Optional[float] = Field(None, gt=0)
    sample_id: Optional[str] = Field(None, max_length=50)
    batch_id: Optional[str] = Field(None, max_length=50)
    lab: Optional[str] = Field(None, max_length=100)
    assay_date: Optional[date] = None
    elements: Optional[Dict[str, ElementResult]] = None
    qc_flags: Optional[Dict[str, Any]] = None

class DrillAssay(DrillAssayBase, TimestampMixin):
    id: UUID
    collar_id: UUID

# Geochemistry Sample schemas
class GeochemSampleBase(BaseSchema):
    sample_id: str = Field(..., min_length=1, max_length=50)
    sample_type: str = Field(..., max_length=50, description="soil, rock, stream_sediment, etc.")
    easting: float = Field(..., description="Easting coordinate")
    northing: float = Field(..., description="Northing coordinate")
    elevation: Optional[float] = None
    collection_date: Optional[date] = None
    collector: Optional[str] = Field(None, max_length=100)
    sample_weight_kg: Optional[float] = Field(None, gt=0)
    description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

class GeochemSampleCreate(GeochemSampleBase):
    org_id: UUID
    project_id: UUID
    country_code: str = Field(..., min_length=2, max_length=2)
    data_classification: DataClassification = DataClassification.INTERNAL
    provenance_id: Optional[UUID] = None

class GeochemSampleUpdate(BaseSchema):
    sample_id: Optional[str] = Field(None, min_length=1, max_length=50)
    sample_type: Optional[str] = Field(None, max_length=50)
    easting: Optional[float] = None
    northing: Optional[float] = None
    elevation: Optional[float] = None
    collection_date: Optional[date] = None
    collector: Optional[str] = Field(None, max_length=100)
    sample_weight_kg: Optional[float] = Field(None, gt=0)
    description: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

class GeochemSample(GeochemSampleBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID
    country_code: str
    data_classification: DataClassification
    provenance_id: Optional[UUID] = None

# Geochemistry Result schemas
class GeochemResultBase(BaseSchema):
    batch_id: Optional[str] = Field(None, max_length=50)
    lab: str = Field(..., max_length=100)
    analysis_date: Optional[date] = None
    method: Optional[str] = Field(None, max_length=100)
    elements: Dict[str, ElementResult] = Field(..., description="Element results")
    qc_flags: Optional[Dict[str, Any]] = None

class GeochemResultCreate(GeochemResultBase):
    sample_id: UUID

class GeochemResultUpdate(BaseSchema):
    batch_id: Optional[str] = Field(None, max_length=50)
    lab: Optional[str] = Field(None, max_length=100)
    analysis_date: Optional[date] = None
    method: Optional[str] = Field(None, max_length=100)
    elements: Optional[Dict[str, ElementResult]] = None
    qc_flags: Optional[Dict[str, Any]] = None

class GeochemResult(GeochemResultBase, TimestampMixin):
    id: UUID
    sample_id: UUID

# Chain of Custody Batch schemas
class COCBatchBase(BaseSchema):
    batch_id: str = Field(..., min_length=1, max_length=50)
    lab: str = Field(..., max_length=100)
    submitted_date: date
    received_date: Optional[date] = None
    completed_date: Optional[date] = None
    sample_count: int = Field(..., gt=0)
    qc_sample_count: int = Field(default=0, ge=0)
    status: str = Field(default="submitted", max_length=20)
    notes: Optional[str] = None

class COCBatchCreate(COCBatchBase):
    org_id: UUID
    project_id: UUID

class COCBatchUpdate(BaseSchema):
    received_date: Optional[date] = None
    completed_date: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None

class COCBatch(COCBatchBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID

# QC Rule schemas
class QCRuleBase(BaseSchema):
    element: str = Field(..., max_length=10)
    standard_id: Optional[str] = Field(None, max_length=50)
    expected_value: Optional[float] = None
    tolerance_percent: float = Field(default=10.0, gt=0)
    warning_limit: float = Field(default=2.0, gt=0, description="Z-score warning limit")
    control_limit: float = Field(default=3.0, gt=0, description="Z-score control limit")
    active: bool = True

class QCRuleCreate(QCRuleBase):
    org_id: UUID
    project_id: UUID

class QCRuleUpdate(BaseSchema):
    standard_id: Optional[str] = Field(None, max_length=50)
    expected_value: Optional[float] = None
    tolerance_percent: Optional[float] = Field(None, gt=0)
    warning_limit: Optional[float] = Field(None, gt=0)
    control_limit: Optional[float] = Field(None, gt=0)
    active: Optional[bool] = None

class QCRule(QCRuleBase, TimestampMixin):
    id: UUID
    org_id: UUID
    project_id: UUID

# QC Result schemas
class QCResultBase(BaseSchema):
    qc_type: str = Field(..., max_length=20, description="standard, blank, duplicate")
    element: str = Field(..., max_length=10)
    measured_value: Optional[float] = None
    expected_value: Optional[float] = None
    z_score: Optional[float] = None
    flag: Optional[str] = Field(None, max_length=20, description="pass, warning, fail")
    notes: Optional[str] = None

class QCResultCreate(QCResultBase):
    batch_id: UUID

class QCResult(QCResultBase, TimestampMixin):
    id: UUID
    batch_id: UUID

# Bulk import schemas
class DrillHoleImport(BaseSchema):
    collars: List[DrillCollarCreate]
    surveys: Optional[List[DrillSurveyCreate]] = None
    intervals: Optional[List[DrillIntervalCreate]] = None
    assays: Optional[List[DrillAssayCreate]] = None

class GeochemImport(BaseSchema):
    samples: List[GeochemSampleCreate]
    results: Optional[List[GeochemResultCreate]] = None

# Validation schemas
class DrillHoleValidation(BaseSchema):
    hole_id: str
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []

class IntervalValidation(BaseSchema):
    collar_id: UUID
    overlaps: List[Dict[str, Any]] = []
    gaps: List[Dict[str, Any]] = []
    is_valid: bool