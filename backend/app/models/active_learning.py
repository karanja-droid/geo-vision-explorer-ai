"""Active Learning Models

SQLAlchemy models for the active learning system including training labels,
model versions, metrics, and high uncertainty zones.
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from uuid import uuid4

from app.database import Base


class TrainingLabel(Base):
    """Training labels provided by domain experts for active learning
    
    Stores user-provided labels with spatial coordinates, confidence scores,
    and metadata for model retraining.
    """
    __tablename__ = 'training_labels'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    geom = Column(Geometry('POINT', srid=4326), nullable=False, index=True)
    label_value = Column(Float, nullable=False)  # 0.0 to 1.0
    confidence = Column(Float, default=1.0)  # User confidence in label
    source = Column(String, default='user', index=True)  # user, expert, synthetic
    weight = Column(Float, default=1.0)  # Weight for training
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    
    # Context information
    inference_id = Column(String)  # Associated inference if available
    uncertainty_value = Column(Float)  # Uncertainty at this location
    prediction_value = Column(Float)  # Model prediction at this location
    
    # Multi-tenancy and access control
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), index=True)
    data_classification = Column(String, default='internal')
    
    # Relationships
    organization = relationship("Organization", back_populates="training_labels")
    project = relationship("Project", back_populates="training_labels")
    
    def __repr__(self):
        return f"<TrainingLabel(id={self.id}, label={self.label_value}, confidence={self.confidence})>"


class ModelVersion(Base):
    """Model versions for tracking training iterations
    
    Tracks different versions of the prospectivity model created through
    active learning and retraining processes.
    """
    __tablename__ = 'model_versions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    version = Column(String, nullable=False, unique=True, index=True)
    base_version = Column(String)  # Parent model version
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    
    # Training information
    training_samples = Column(Integer, default=0)
    status = Column(String, default='training', index=True)  # training, active, archived, failed
    model_path = Column(String)  # S3 path to model artifacts
    training_config = Column(JSON)  # Training hyperparameters and config
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Relationships
    metrics = relationship("ModelMetric", back_populates="model_version", cascade="all, delete-orphan")
    organization = relationship("Organization", back_populates="model_versions")
    project = relationship("Project", back_populates="model_versions")
    
    def __repr__(self):
        return f"<ModelVersion(version={self.version}, status={self.status})>"


class ModelMetric(Base):
    """Model performance metrics
    
    Stores various performance metrics for model versions including
    AUC, precision, recall, F1, and custom geological metrics.
    """
    __tablename__ = 'model_metrics'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    model_version_id = Column(UUID(as_uuid=True), ForeignKey('model_versions.id', ondelete='CASCADE'))
    metric_name = Column(String, nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    metric_type = Column(String, default='validation')  # validation, test, cross_validation
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    model_version = relationship("ModelVersion", back_populates="metrics")
    
    def __repr__(self):
        return f"<ModelMetric(name={self.metric_name}, value={self.metric_value})>"


class HighUncertaintyZone(Base):
    """High uncertainty zones for active learning suggestions
    
    Identifies areas where the model has high uncertainty and would benefit
    from additional training labels.
    """
    __tablename__ = 'high_uncertainty_zones'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    inference_id = Column(String, nullable=False, index=True)
    geom = Column(Geometry('POINT', srid=4326), nullable=False, index=True)
    uncertainty_value = Column(Float, nullable=False)
    prediction_value = Column(Float, nullable=False)
    priority_score = Column(Float, nullable=False, index=True)  # Combined score for labeling priority
    is_labeled = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'))
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Relationships
    organization = relationship("Organization", back_populates="uncertainty_zones")
    project = relationship("Project", back_populates="uncertainty_zones")
    
    def __repr__(self):
        return f"<HighUncertaintyZone(inference_id={self.inference_id}, uncertainty={self.uncertainty_value})>"


# Update existing models to include relationships
def update_existing_models():
    """Update existing models with active learning relationships"""
    from app.models.feature_store import Organization, Project
    
    # Add relationships to Organization
    if not hasattr(Organization, 'training_labels'):
        Organization.training_labels = relationship("TrainingLabel", back_populates="organization")
    if not hasattr(Organization, 'model_versions'):
        Organization.model_versions = relationship("ModelVersion", back_populates="organization")
    if not hasattr(Organization, 'uncertainty_zones'):
        Organization.uncertainty_zones = relationship("HighUncertaintyZone", back_populates="organization")
    
    # Add relationships to Project
    if not hasattr(Project, 'training_labels'):
        Project.training_labels = relationship("TrainingLabel", back_populates="project")
    if not hasattr(Project, 'model_versions'):
        Project.model_versions = relationship("ModelVersion", back_populates="project")
    if not hasattr(Project, 'uncertainty_zones'):
        Project.uncertainty_zones = relationship("HighUncertaintyZone", back_populates="project")