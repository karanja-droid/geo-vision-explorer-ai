"""Prospectivity and AI analysis schemas"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from datetime import datetime
from enum import Enum

class ModelType(str, Enum):
    """AI model types"""
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    NEURAL_NETWORK = "neural_network"
    SVM = "svm"
    LOGISTIC_REGRESSION = "logistic_regression"

class ModelStatus(str, Enum):
    """AI model status"""
    DRAFT = "draft"
    TRAINING = "training"
    READY = "ready"
    FAILED = "failed"
    DEPRECATED = "deprecated"

class RunStatus(str, Enum):
    """Prospectivity run status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ConfidenceLevel(str, Enum):
    """Confidence levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"

# AI Model schemas
class AIModelBase(BaseModel):
    """Base AI model schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    model_type: ModelType
    target_commodity: str = Field(..., min_length=1, max_length=100)
    org_id: UUID
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    feature_config: Optional[Dict[str, Any]] = Field(default_factory=dict)

class AIModelCreate(AIModelBase):
    """Schema for creating AI model"""
    pass

class AIModelUpdate(BaseModel):
    """Schema for updating AI model"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    parameters: Optional[Dict[str, Any]] = None
    feature_config: Optional[Dict[str, Any]] = None
    status: Optional[ModelStatus] = None

class AIModel(AIModelBase):
    """Complete AI model schema"""
    id: UUID
    status: ModelStatus = ModelStatus.DRAFT
    version: str = "1.0"
    validation_accuracy: Optional[float] = Field(None, ge=0, le=1)
    training_samples: Optional[int] = Field(None, ge=0)
    feature_count: Optional[int] = Field(None, ge=0)
    model_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    trained_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Training Data schemas
class TrainingDataBase(BaseModel):
    """Base training data schema"""
    model_id: UUID
    project_id: UUID
    easting: float = Field(..., ge=-180, le=180)
    northing: float = Field(..., ge=-90, le=90)
    is_positive: bool
    confidence: Optional[float] = Field(None, ge=0, le=1)
    validation_set: bool = False
    features: Optional[Dict[str, Any]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class TrainingDataCreate(TrainingDataBase):
    """Schema for creating training data"""
    pass

class TrainingData(TrainingDataBase):
    """Complete training data schema"""
    id: UUID
    geom: Optional[str] = None  # PostGIS geometry as WKT
    created_at: datetime

    class Config:
        from_attributes = True

# Prospectivity Run schemas
class ProspectivityRunBase(BaseModel):
    """Base prospectivity run schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    model_id: UUID
    project_id: UUID
    analysis_area: Optional[Dict[str, Any]] = None  # GeoJSON polygon
    grid_resolution: float = Field(50.0, gt=0, le=1000)  # meters
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProspectivityRunCreate(ProspectivityRunBase):
    """Schema for creating prospectivity run"""
    pass

class ProspectivityRunUpdate(BaseModel):
    """Schema for updating prospectivity run"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    parameters: Optional[Dict[str, Any]] = None

class ProspectivityRun(ProspectivityRunBase):
    """Complete prospectivity run schema"""
    id: UUID
    status: RunStatus = RunStatus.PENDING
    progress_percent: float = Field(0.0, ge=0, le=100)
    target_count: Optional[int] = Field(None, ge=0)
    output_raster_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

# Prospectivity Target schemas
class ProspectivityTargetBase(BaseModel):
    """Base prospectivity target schema"""
    run_id: UUID
    easting: float = Field(..., ge=-180, le=180)
    northing: float = Field(..., ge=-90, le=90)
    prospectivity_score: float = Field(..., ge=0, le=1)
    confidence_level: ConfidenceLevel
    uncertainty: Optional[float] = Field(None, ge=0, le=1)
    feature_contributions: Optional[Dict[str, float]] = Field(default_factory=dict)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProspectivityTarget(ProspectivityTargetBase):
    """Complete prospectivity target schema"""
    id: UUID
    geom: Optional[str] = None  # PostGIS geometry as WKT
    created_at: datetime

    class Config:
        from_attributes = True

# Model Performance schemas
class ModelPerformanceBase(BaseModel):
    """Base model performance schema"""
    model_id: UUID
    validation_type: str = Field(..., max_length=50)  # cross_validation, holdout, etc.
    metric_name: str = Field(..., max_length=100)
    metric_value: float
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ModelPerformance(ModelPerformanceBase):
    """Complete model performance schema"""
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Feature Importance schemas
class FeatureImportanceBase(BaseModel):
    """Base feature importance schema"""
    model_id: UUID
    feature_name: str = Field(..., max_length=255)
    importance_score: float = Field(..., ge=0)
    importance_rank: int = Field(..., ge=1)
    feature_type: str = Field(..., max_length=100)  # geological, geochemical, geophysical, etc.
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class FeatureImportance(FeatureImportanceBase):
    """Complete feature importance schema"""
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Model Prediction schemas
class ModelPredictionBase(BaseModel):
    """Base model prediction schema"""
    model_id: UUID
    run_id: Optional[UUID] = None
    easting: float = Field(..., ge=-180, le=180)
    northing: float = Field(..., ge=-90, le=90)
    prediction_score: float = Field(..., ge=0, le=1)
    prediction_class: bool  # True for positive, False for negative
    confidence: Optional[float] = Field(None, ge=0, le=1)
    features: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ModelPrediction(ModelPredictionBase):
    """Complete model prediction schema"""
    id: UUID
    geom: Optional[str] = None  # PostGIS geometry as WKT
    created_at: datetime

    class Config:
        from_attributes = True

# Request schemas for complex operations
class ModelTrainingRequest(BaseModel):
    """Schema for model training request"""
    training_data_filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    validation_split: float = Field(0.2, gt=0, lt=1)
    cross_validation_folds: int = Field(5, ge=2, le=20)
    hyperparameter_tuning: bool = True
    feature_selection: bool = True
    class_balancing: bool = True
    training_parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ProspectivityAnalysisRequest(BaseModel):
    """Schema for prospectivity analysis request"""
    analysis_area: Optional[Dict[str, Any]] = None  # GeoJSON polygon
    grid_resolution: float = Field(50.0, gt=0, le=1000)
    output_formats: List[str] = Field(default=["raster", "targets"])
    confidence_threshold: float = Field(0.5, ge=0, le=1)
    max_targets: Optional[int] = Field(None, gt=0, le=10000)
    feature_layers: Optional[List[str]] = None
    processing_parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @validator('output_formats')
    def validate_output_formats(cls, v):
        valid_formats = ["raster", "targets", "uncertainty", "features"]
        for format_type in v:
            if format_type not in valid_formats:
                raise ValueError(f"Invalid output format: {format_type}")
        return v

# Bulk operation schemas
class BulkTrainingDataImport(BaseModel):
    """Schema for bulk training data import"""
    model_id: UUID
    project_id: UUID
    data_sources: List[str] = Field(..., min_items=1)
    positive_criteria: Dict[str, Any]
    negative_criteria: Dict[str, Any]
    validation_split: float = Field(0.2, gt=0, lt=1)
    auto_balance: bool = True
    quality_filters: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ModelComparisonRequest(BaseModel):
    """Schema for comparing multiple models"""
    model_ids: List[UUID] = Field(..., min_items=2, max_items=10)
    comparison_metrics: List[str] = Field(default=["accuracy", "precision", "recall", "f1"])
    test_dataset_id: Optional[UUID] = None
    cross_validation: bool = True

class ModelEnsembleRequest(BaseModel):
    """Schema for creating model ensemble"""
    model_ids: List[UUID] = Field(..., min_items=2, max_items=10)
    ensemble_method: str = Field("voting", regex="^(voting|stacking|bagging)$")
    weights: Optional[List[float]] = None
    meta_learner: Optional[str] = None

# Response schemas
class ModelTrainingResponse(BaseModel):
    """Response schema for model training"""
    model_id: UUID
    status: str
    training_job_id: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    message: str

class ProspectivityAnalysisResponse(BaseModel):
    """Response schema for prospectivity analysis"""
    run_id: UUID
    status: str
    analysis_job_id: Optional[str] = None
    estimated_completion: Optional[datetime] = None
    message: str

class ModelPerformanceReport(BaseModel):
    """Schema for model performance report"""
    model_id: UUID
    model_name: str
    overall_accuracy: float
    validation_metrics: Dict[str, float]
    feature_importance: List[Dict[str, Union[str, float, int]]]
    confusion_matrix: Optional[List[List[int]]] = None
    roc_curve: Optional[Dict[str, List[float]]] = None
    training_history: Optional[Dict[str, List[float]]] = None

class ProspectivitySummary(BaseModel):
    """Schema for prospectivity summary statistics"""
    project_id: UUID
    total_models: int
    active_models: int
    total_runs: int
    completed_runs: int
    success_rate: float
    total_targets: int
    high_confidence_targets: int
    average_prospectivity_score: Optional[float] = None
    last_analysis: Optional[datetime] = None