"""Prospectivity and AI analysis database models"""

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
import uuid

from app.database import Base

class AIModel(Base):
    """AI model for prospectivity analysis"""
    __tablename__ = "ai_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    model_type = Column(String(50), nullable=False)  # random_forest, neural_network, etc.
    target_commodity = Column(String(100), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    status = Column(String(20), nullable=False, default="draft")  # draft, training, ready, failed, deprecated
    version = Column(String(20), nullable=False, default="1.0")
    
    # Model configuration
    parameters = Column(JSONB, default={})
    feature_config = Column(JSONB, default={})
    
    # Performance metrics
    validation_accuracy = Column(Float)
    training_samples = Column(Integer)
    feature_count = Column(Integer)
    
    # File storage
    model_file_path = Column(String(500))  # Path to serialized model file
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    trained_at = Column(DateTime(timezone=True))
    
    # Relationships
    organization = relationship("Organization", back_populates="ai_models")
    training_data = relationship("TrainingData", back_populates="model", cascade="all, delete-orphan")
    prospectivity_runs = relationship("ProspectivityRun", back_populates="model")
    performance_metrics = relationship("ModelPerformance", back_populates="model", cascade="all, delete-orphan")
    feature_importance = relationship("FeatureImportance", back_populates="model", cascade="all, delete-orphan")
    predictions = relationship("ModelPrediction", back_populates="model")
    
    # Indexes
    __table_args__ = (
        Index('idx_ai_models_org_id', 'org_id'),
        Index('idx_ai_models_status', 'status'),
        Index('idx_ai_models_model_type', 'model_type'),
        Index('idx_ai_models_target_commodity', 'target_commodity'),
        Index('idx_ai_models_created_at', 'created_at'),
    )

class TrainingData(Base):
    """Training data points for AI models"""
    __tablename__ = "training_data"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Spatial location
    easting = Column(Float, nullable=False)
    northing = Column(Float, nullable=False)
    geom = Column(Geometry('POINT', srid=4326))
    
    # Training labels
    is_positive = Column(Boolean, nullable=False)  # True for positive samples, False for negative
    confidence = Column(Float)  # Confidence in the label (0-1)
    validation_set = Column(Boolean, nullable=False, default=False)
    
    # Feature data
    features = Column(JSONB, default={})  # Feature values for this point
    metadata = Column(JSONB, default={})  # Additional metadata
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    model = relationship("AIModel", back_populates="training_data")
    project = relationship("Project", back_populates="training_data")
    
    # Indexes
    __table_args__ = (
        Index('idx_training_data_model_id', 'model_id'),
        Index('idx_training_data_project_id', 'project_id'),
        Index('idx_training_data_is_positive', 'is_positive'),
        Index('idx_training_data_validation_set', 'validation_set'),
        Index('idx_training_data_geom', 'geom', postgresql_using='gist'),
    )

class ProspectivityRun(Base):
    """Prospectivity analysis run"""
    __tablename__ = "prospectivity_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    
    # Analysis configuration
    analysis_area = Column(JSONB)  # GeoJSON polygon defining analysis area
    grid_resolution = Column(Float, nullable=False, default=50.0)  # Grid resolution in meters
    parameters = Column(JSONB, default={})  # Analysis parameters
    
    # Status and progress
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed, cancelled
    progress_percent = Column(Float, nullable=False, default=0.0)
    target_count = Column(Integer)  # Number of targets generated
    
    # Output files
    output_raster_path = Column(String(500))  # Path to output raster file
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # Error handling
    error_message = Column(Text)
    
    # Relationships
    model = relationship("AIModel", back_populates="prospectivity_runs")
    project = relationship("Project", back_populates="prospectivity_runs")
    targets = relationship("ProspectivityTarget", back_populates="run", cascade="all, delete-orphan")
    predictions = relationship("ModelPrediction", back_populates="run")
    
    # Indexes
    __table_args__ = (
        Index('idx_prospectivity_runs_model_id', 'model_id'),
        Index('idx_prospectivity_runs_project_id', 'project_id'),
        Index('idx_prospectivity_runs_status', 'status'),
        Index('idx_prospectivity_runs_created_at', 'created_at'),
    )

class ProspectivityTarget(Base):
    """Generated prospectivity targets"""
    __tablename__ = "prospectivity_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("prospectivity_runs.id"), nullable=False)
    
    # Spatial location
    easting = Column(Float, nullable=False)
    northing = Column(Float, nullable=False)
    geom = Column(Geometry('POINT', srid=4326))
    
    # Prospectivity metrics
    prospectivity_score = Column(Float, nullable=False)  # 0-1 prospectivity score
    confidence_level = Column(String(20), nullable=False)  # low, medium, high, very_high
    uncertainty = Column(Float)  # Uncertainty measure (0-1)
    
    # Feature analysis
    feature_contributions = Column(JSONB, default={})  # Feature contribution to score
    metadata = Column(JSONB, default={})  # Additional metadata
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    run = relationship("ProspectivityRun", back_populates="targets")
    
    # Indexes
    __table_args__ = (
        Index('idx_prospectivity_targets_run_id', 'run_id'),
        Index('idx_prospectivity_targets_score', 'prospectivity_score'),
        Index('idx_prospectivity_targets_confidence', 'confidence_level'),
        Index('idx_prospectivity_targets_geom', 'geom', postgresql_using='gist'),
    )

class ModelPerformance(Base):
    """Model performance metrics"""
    __tablename__ = "model_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=False)
    
    # Performance metrics
    validation_type = Column(String(50), nullable=False)  # cross_validation, holdout, etc.
    metric_name = Column(String(100), nullable=False)  # accuracy, precision, recall, f1, auc, etc.
    metric_value = Column(Float, nullable=False)
    
    # Additional metadata
    metadata = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    model = relationship("AIModel", back_populates="performance_metrics")
    
    # Indexes
    __table_args__ = (
        Index('idx_model_performance_model_id', 'model_id'),
        Index('idx_model_performance_metric_name', 'metric_name'),
        Index('idx_model_performance_validation_type', 'validation_type'),
    )

class FeatureImportance(Base):
    """Feature importance for AI models"""
    __tablename__ = "feature_importance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=False)
    
    # Feature information
    feature_name = Column(String(255), nullable=False)
    importance_score = Column(Float, nullable=False)
    importance_rank = Column(Integer, nullable=False)
    feature_type = Column(String(100), nullable=False)  # geological, geochemical, geophysical, etc.
    
    # Additional metadata
    metadata = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    model = relationship("AIModel", back_populates="feature_importance")
    
    # Indexes
    __table_args__ = (
        Index('idx_feature_importance_model_id', 'model_id'),
        Index('idx_feature_importance_rank', 'importance_rank'),
        Index('idx_feature_importance_type', 'feature_type'),
    )

class ModelPrediction(Base):
    """Individual model predictions"""
    __tablename__ = "model_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ai_models.id"), nullable=False)
    run_id = Column(UUID(as_uuid=True), ForeignKey("prospectivity_runs.id"))
    
    # Spatial location
    easting = Column(Float, nullable=False)
    northing = Column(Float, nullable=False)
    geom = Column(Geometry('POINT', srid=4326))
    
    # Prediction results
    prediction_score = Column(Float, nullable=False)  # Raw prediction score (0-1)
    prediction_class = Column(Boolean, nullable=False)  # Binary classification result
    confidence = Column(Float)  # Prediction confidence (0-1)
    
    # Feature data used for prediction
    features = Column(JSONB, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    model = relationship("AIModel", back_populates="predictions")
    run = relationship("ProspectivityRun", back_populates="predictions")
    
    # Indexes
    __table_args__ = (
        Index('idx_model_predictions_model_id', 'model_id'),
        Index('idx_model_predictions_run_id', 'run_id'),
        Index('idx_model_predictions_score', 'prediction_score'),
        Index('idx_model_predictions_class', 'prediction_class'),
        Index('idx_model_predictions_geom', 'geom', postgresql_using='gist'),
    )

# Add relationships to existing models
def add_prospectivity_relationships():
    """Add relationships to existing models"""
    from app.models.core import Organization, Project
    
    # Add to Organization model
    Organization.ai_models = relationship("AIModel", back_populates="organization")
    
    # Add to Project model
    Project.training_data = relationship("TrainingData", back_populates="project")
    Project.prospectivity_runs = relationship("ProspectivityRun", back_populates="project")