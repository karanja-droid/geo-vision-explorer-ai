"""Drill Hole Data Models

SQLAlchemy models for drill hole data management including collars, surveys,
intervals, assays, and QA/QC functionality.
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, Date, DateTime, Text, JSON, ForeignKey, CheckConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from uuid import uuid4

from app.database import Base


class DrillCollar(Base):
    """Drill hole collar locations and metadata
    
    Stores the surface location and basic information for each drill hole
    including planned trajectory and drilling parameters.
    """
    __tablename__ = 'drill_collars'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hole_id = Column(String, nullable=False, unique=True, index=True)
    geom = Column(Geometry('POINT', srid=4326), nullable=False, index=True)
    elevation = Column(Float)
    total_depth = Column(Float)
    start_date = Column(Date, index=True)
    end_date = Column(Date)
    azimuth = Column(Float)  # Planned azimuth
    dip = Column(Float)      # Planned dip
    crs = Column(String, default='EPSG:4326')
    drill_type = Column(String)  # RC, Diamond, etc.
    contractor = Column(String)
    project = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Multi-tenancy and access control
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'), index=True)
    data_classification = Column(String, default='internal')
    
    # Relationships
    surveys = relationship("DrillSurvey", back_populates="collar", cascade="all, delete-orphan")
    intervals = relationship("DrillInterval", back_populates="collar", cascade="all, delete-orphan")
    assays = relationship("DrillAssay", back_populates="collar", cascade="all, delete-orphan")
    qa_results = relationship("QAResult", back_populates="collar", cascade="all, delete-orphan")
    organization = relationship("Organization", back_populates="drill_collars")
    project_rel = relationship("Project", back_populates="drill_collars")
    
    def __repr__(self):
        return f"<DrillCollar(hole_id={self.hole_id}, depth={self.total_depth})>"


class DrillSurvey(Base):
    """Drill hole survey data for deviation correction
    
    Stores downhole survey measurements used to calculate the actual
    3D trajectory of the drill hole.
    """
    __tablename__ = 'drill_surveys'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hole_id = Column(String, ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False, index=True)
    depth = Column(Float, nullable=False, index=True)
    azimuth = Column(Float, nullable=False)
    dip = Column(Float, nullable=False)
    method = Column(String)  # Gyro, Magnetic, etc.
    survey_date = Column(Date)
    quality_code = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="surveys")
    organization = relationship("Organization", back_populates="drill_surveys")
    project_rel = relationship("Project", back_populates="drill_surveys")
    
    def __repr__(self):
        return f"<DrillSurvey(hole_id={self.hole_id}, depth={self.depth})>"


class DrillInterval(Base):
    """Geological intervals from drill holes
    
    Stores geological logging information including lithology,
    alteration, mineralization, and core quality data.
    """
    __tablename__ = 'drill_intervals'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hole_id = Column(String, ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False, index=True)
    from_m = Column(Float, nullable=False)
    to_m = Column(Float, nullable=False)
    lith_code = Column(String, index=True)
    description = Column(Text)
    alteration = Column(String)
    mineralization = Column(String)
    recovery = Column(Float)  # Core recovery percentage
    rqd = Column(Float)       # Rock Quality Designation
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Constraints
    __table_args__ = (
        CheckConstraint('from_m < to_m', name='check_interval_order'),
    )
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="intervals")
    organization = relationship("Organization", back_populates="drill_intervals")
    project_rel = relationship("Project", back_populates="drill_intervals")
    
    @property
    def interval_length(self):
        """Calculate interval length"""
        return self.to_m - self.from_m if self.to_m and self.from_m else None
    
    def __repr__(self):
        return f"<DrillInterval(hole_id={self.hole_id}, {self.from_m}-{self.to_m}m)>"


class DrillAssay(Base):
    """Assay results from drill hole samples
    
    Stores analytical results for various elements with quality control
    information and laboratory metadata.
    """
    __tablename__ = 'drill_assays'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hole_id = Column(String, ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False, index=True)
    from_m = Column(Float, nullable=False)
    to_m = Column(Float, nullable=False)
    element = Column(String, nullable=False, index=True)
    value = Column(Float)
    units = Column(String)
    method = Column(String)  # Analytical method
    lab = Column(String)     # Laboratory
    batch = Column(String, index=True)   # Lab batch number
    detection_limit = Column(Float)
    quality_code = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Constraints
    __table_args__ = (
        CheckConstraint('from_m < to_m', name='check_assay_interval_order'),
    )
    
    # Relationships
    collar = relationship("DrillCollar", back_populates="assays")
    organization = relationship("Organization", back_populates="drill_assays")
    project_rel = relationship("Project", back_populates="drill_assays")
    
    @property
    def sample_length(self):
        """Calculate sample length"""
        return self.to_m - self.from_m if self.to_m and self.from_m else None
    
    @property
    def is_below_detection_limit(self):
        """Check if value is below detection limit"""
        return (self.value is not None and 
                self.detection_limit is not None and 
                self.value < self.detection_limit)
    
    def __repr__(self):
        return f"<DrillAssay(hole_id={self.hole_id}, {self.element}={self.value})>"


class QARule(Base):
    """Quality assurance rules for drill hole data validation
    
    Defines validation rules that are applied to drill hole data
    to identify potential issues and inconsistencies.
    """
    __tablename__ = 'qa_rules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rule_name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False, index=True)  # interval_overlap, duplicate_hole, etc.
    severity = Column(String, default='warning')  # error, warning, info
    description = Column(Text)
    parameters = Column(JSON)  # Rule-specific parameters
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    
    # Relationships
    results = relationship("QAResult", back_populates="rule", cascade="all, delete-orphan")
    organization = relationship("Organization", back_populates="qa_rules")
    
    def __repr__(self):
        return f"<QARule(name={self.rule_name}, type={self.rule_type})>"


class QAResult(Base):
    """Results from quality assurance rule execution
    
    Stores the results of QA rule validation including identified
    issues, their severity, and resolution status.
    """
    __tablename__ = 'qa_results'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey('qa_rules.id', ondelete='CASCADE'))
    hole_id = Column(String, ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), index=True)
    severity = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=False)
    details = Column(JSON)  # Additional details about the issue
    status = Column(String, default='open', index=True)  # open, resolved, ignored
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(UUID(as_uuid=True))
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'))
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Relationships
    rule = relationship("QARule", back_populates="results")
    collar = relationship("DrillCollar", back_populates="qa_results")
    organization = relationship("Organization", back_populates="qa_results")
    project_rel = relationship("Project", back_populates="qa_results")
    
    def __repr__(self):
        return f"<QAResult(hole_id={self.hole_id}, severity={self.severity})>"


class QAReport(Base):
    """Quality assurance reports
    
    Tracks the generation and storage of QA reports including
    summary statistics and file locations.
    """
    __tablename__ = 'qa_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    report_name = Column(String, nullable=False)
    report_type = Column(String, default='nightly', index=True)  # nightly, on_demand, upload
    status = Column(String, default='generating', index=True)  # generating, completed, failed
    total_holes = Column(Integer, default=0)
    total_issues = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)
    report_path = Column(String)  # S3 path to report files
    summary = Column(JSON)  # Report summary statistics
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    created_by = Column(UUID(as_uuid=True))
    
    # Multi-tenancy
    org_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id'), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey('projects.id'))
    
    # Relationships
    organization = relationship("Organization", back_populates="qa_reports")
    project_rel = relationship("Project", back_populates="qa_reports")
    
    def __repr__(self):
        return f"<QAReport(name={self.report_name}, status={self.status})>"


# Update existing models to include relationships
def update_existing_models():
    """Update existing models with drill data relationships"""
    from app.models.feature_store import Organization, Project
    
    # Add relationships to Organization
    if not hasattr(Organization, 'drill_collars'):
        Organization.drill_collars = relationship("DrillCollar", back_populates="organization")
    if not hasattr(Organization, 'drill_surveys'):
        Organization.drill_surveys = relationship("DrillSurvey", back_populates="organization")
    if not hasattr(Organization, 'drill_intervals'):
        Organization.drill_intervals = relationship("DrillInterval", back_populates="organization")
    if not hasattr(Organization, 'drill_assays'):
        Organization.drill_assays = relationship("DrillAssay", back_populates="organization")
    if not hasattr(Organization, 'qa_rules'):
        Organization.qa_rules = relationship("QARule", back_populates="organization")
    if not hasattr(Organization, 'qa_results'):
        Organization.qa_results = relationship("QAResult", back_populates="organization")
    if not hasattr(Organization, 'qa_reports'):
        Organization.qa_reports = relationship("QAReport", back_populates="organization")
    
    # Add relationships to Project
    if not hasattr(Project, 'drill_collars'):
        Project.drill_collars = relationship("DrillCollar", back_populates="project_rel")
    if not hasattr(Project, 'drill_surveys'):
        Project.drill_surveys = relationship("DrillSurvey", back_populates="project_rel")
    if not hasattr(Project, 'drill_intervals'):
        Project.drill_intervals = relationship("DrillInterval", back_populates="project_rel")
    if not hasattr(Project, 'drill_assays'):
        Project.drill_assays = relationship("DrillAssay", back_populates="project_rel")
    if not hasattr(Project, 'qa_results'):
        Project.qa_results = relationship("QAResult", back_populates="project_rel")
    if not hasattr(Project, 'qa_reports'):
        Project.qa_reports = relationship("QAReport", back_populates="project_rel")