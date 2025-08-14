"""Drilling and geochemistry data models"""

from sqlalchemy import Column, String, DateTime, Text, Float, Integer, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from .core import Base
import uuid

class DrillCollar(Base):
    __tablename__ = "drill_collars"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    hole_id = Column(String(50), nullable=False)
    easting = Column(Float, nullable=False)
    northing = Column(Float, nullable=False)
    elevation = Column(Float, nullable=False)
    total_depth = Column(Float, nullable=False)
    azimuth = Column(Float)
    dip = Column(Float)
    drill_date = Column(String(20))
    drill_type = Column(String(50))  # RC, DD, RAB, etc.
    contractor = Column(String(100))
    status = Column(String(20))  # planned, drilling, completed, abandoned
    geom = Column(Geometry('POINT', srid=4326))
    attributes = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('org_id', 'project_id', 'hole_id', name='unique_hole_id_per_project'),
    )
    
    # Relationships
    surveys = relationship("DrillSurvey", back_populates="collar")
    intervals = relationship("DrillInterval", back_populates="collar")
    assays = relationship("DrillAssay", back_populates="collar")

class DrillSurvey(Base):
    __tablename__ = "drill_surveys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collar_id = Column(UUID(as_uuid=True), ForeignKey('drill_collars.id'), nullable=False)
    depth_m = Column(Float, nullable=False)
    azimuth = Column(Float, nullable=False)
    dip = Column(Float, nullable=False)
    survey_method = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        UniqueConstraint('collar_id', 'depth_m', name='unique_survey_depth_per_hole'),
    )
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="surveys")

class DrillInterval(Base):
    __tablename__ = "drill_intervals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collar_id = Column(UUID(as_uuid=True), ForeignKey('drill_collars.id'), nullable=False)
    from_m = Column(Float, nullable=False)
    to_m = Column(Float, nullable=False)
    lithology = Column(String(100))
    alteration = Column(String(100))
    mineralization = Column(String(100))
    recovery_percent = Column(Float)
    rqd_percent = Column(Float)
    description = Column(Text)
    geologist = Column(String(100))
    logged_date = Column(String(20))
    attributes = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint('from_m < to_m', name='check_interval_order'),
    )
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="intervals")

class DrillAssay(Base):
    __tablename__ = "drill_assays"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collar_id = Column(UUID(as_uuid=True), ForeignKey('drill_collars.id'), nullable=False)
    from_m = Column(Float, nullable=False)
    to_m = Column(Float, nullable=False)
    sample_id = Column(String(50))
    batch_id = Column(String(50))
    lab = Column(String(100))
    assay_date = Column(String(20))
    elements = Column(JSONB, nullable=False)  # {element: {value, unit, detection_limit}}
    qc_flags = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint('from_m < to_m', name='check_assay_interval_order'),
    )
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="assays")

class GeochemSample(Base):
    __tablename__ = "geochem_samples"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    country_code = Column(String(2), nullable=False)
    data_classification = Column(String(20), default='internal')
    provenance_id = Column(UUID(as_uuid=True), ForeignKey('data_provenance.id'))
    sample_id = Column(String(50), nullable=False)
    sample_type = Column(String(50), nullable=False)  # soil, rock, stream_sediment
    easting = Column(Float, nullable=False)
    northing = Column(Float, nullable=False)
    elevation = Column(Float)
    collection_date = Column(String(20))
    collector = Column(String(100))
    sample_weight_kg = Column(Float)
    description = Column(Text)
    geom = Column(Geometry('POINT', srid=4326))
    attributes = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('org_id', 'project_id', 'sample_id', name='unique_sample_id_per_project'),
    )
    
    # Relationships
    results = relationship("GeochemResult", back_populates="sample")

class GeochemResult(Base):
    __tablename__ = "geochem_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sample_id = Column(UUID(as_uuid=True), ForeignKey('geochem_samples.id'), nullable=False)
    batch_id = Column(String(50))
    lab = Column(String(100), nullable=False)
    analysis_date = Column(String(20))
    method = Column(String(100))
    elements = Column(JSONB, nullable=False)  # {element: {value, unit, detection_limit, qualifier}}
    qc_flags = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sample = relationship("GeochemSample", back_populates="results")

class COCBatch(Base):
    __tablename__ = "coc_batches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    batch_id = Column(String(50), nullable=False)
    lab = Column(String(100), nullable=False)
    submitted_date = Column(String(20), nullable=False)
    received_date = Column(String(20))
    completed_date = Column(String(20))
    sample_count = Column(Integer, nullable=False)
    qc_sample_count = Column(Integer, default=0)
    status = Column(String(20), default='submitted')  # submitted, received, in_progress, completed
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('org_id', 'project_id', 'batch_id', name='unique_batch_id_per_project'),
    )

class QCRule(Base):
    __tablename__ = "qc_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), nullable=False)
    element = Column(String(10), nullable=False)
    standard_id = Column(String(50))
    expected_value = Column(Float)
    tolerance_percent = Column(Float, default=10.0)
    warning_limit = Column(Float, default=2.0)  # Z-score
    control_limit = Column(Float, default=3.0)  # Z-score
    active = Column(String(10), default='true')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class QCResult(Base):
    __tablename__ = "qc_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), ForeignKey('coc_batches.id'), nullable=False)
    qc_type = Column(String(20), nullable=False)  # standard, blank, duplicate
    element = Column(String(10), nullable=False)
    measured_value = Column(Float)
    expected_value = Column(Float)
    z_score = Column(Float)
    flag = Column(String(20))  # pass, warning, fail
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())