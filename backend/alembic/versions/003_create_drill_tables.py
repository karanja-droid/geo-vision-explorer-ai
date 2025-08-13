"""Create drill hole tables

Revision ID: 003_drill_tables
Revises: 002_active_learning
Create Date: 2024-01-15 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '003_drill_tables'
down_revision = '002_active_learning'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create drill_collars table
    op.create_table(
        'drill_collars',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hole_id', sa.String, nullable=False, unique=True),
        sa.Column('geom', Geometry('POINT', srid=4326), nullable=False),
        sa.Column('elevation', sa.Float),
        sa.Column('total_depth', sa.Float),
        sa.Column('start_date', sa.Date),
        sa.Column('end_date', sa.Date),
        sa.Column('azimuth', sa.Float),  # Planned azimuth
        sa.Column('dip', sa.Float),      # Planned dip
        sa.Column('crs', sa.String, default='EPSG:4326'),
        sa.Column('drill_type', sa.String),  # RC, Diamond, etc.
        sa.Column('contractor', sa.String),
        sa.Column('project', sa.String),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        sa.Column('data_classification', sa.String, server_default='internal'),
    )
    
    # Create drill_surveys table
    op.create_table(
        'drill_surveys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hole_id', sa.String, sa.ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False),
        sa.Column('depth', sa.Float, nullable=False),
        sa.Column('azimuth', sa.Float, nullable=False),
        sa.Column('dip', sa.Float, nullable=False),
        sa.Column('method', sa.String),  # Gyro, Magnetic, etc.
        sa.Column('survey_date', sa.Date),
        sa.Column('quality_code', sa.String),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
    )
    
    # Create drill_intervals table
    op.create_table(
        'drill_intervals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hole_id', sa.String, sa.ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_m', sa.Float, nullable=False),
        sa.Column('to_m', sa.Float, nullable=False),
        sa.Column('lith_code', sa.String),
        sa.Column('description', sa.Text),
        sa.Column('alteration', sa.String),
        sa.Column('mineralization', sa.String),
        sa.Column('recovery', sa.Float),  # Core recovery percentage
        sa.Column('rqd', sa.Float),       # Rock Quality Designation
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        # Constraint to ensure from < to
        sa.CheckConstraint('from_m < to_m', name='check_interval_order'),
    )
    
    # Create drill_assays table
    op.create_table(
        'drill_assays',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('hole_id', sa.String, sa.ForeignKey('drill_collars.hole_id', ondelete='CASCADE'), nullable=False),
        sa.Column('from_m', sa.Float, nullable=False),
        sa.Column('to_m', sa.Float, nullable=False),
        sa.Column('element', sa.String, nullable=False),
        sa.Column('value', sa.Float),
        sa.Column('units', sa.String),
        sa.Column('method', sa.String),  # Analytical method
        sa.Column('lab', sa.String),     # Laboratory
        sa.Column('batch', sa.String),   # Lab batch number
        sa.Column('detection_limit', sa.Float),
        sa.Column('quality_code', sa.String),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        # Constraint to ensure from < to
        sa.CheckConstraint('from_m < to_m', name='check_assay_interval_order'),
    )
    
    # Create qa_rules table
    op.create_table(
        'qa_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rule_name', sa.String, nullable=False),
        sa.Column('rule_type', sa.String, nullable=False),  # interval_overlap, duplicate_hole, missing_survey, etc.
        sa.Column('severity', sa.String, default='warning'),  # error, warning, info
        sa.Column('description', sa.Text),
        sa.Column('parameters', sa.JSON),  # Rule-specific parameters
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
    )
    
    # Create qa_results table
    op.create_table(
        'qa_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('qa_rules.id', ondelete='CASCADE')),
        sa.Column('hole_id', sa.String, sa.ForeignKey('drill_collars.hole_id', ondelete='CASCADE')),
        sa.Column('severity', sa.String, nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('details', sa.JSON),  # Additional details about the issue
        sa.Column('status', sa.String, default='open'),  # open, resolved, ignored
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True)),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
    )
    
    # Create qa_reports table
    op.create_table(
        'qa_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('report_name', sa.String, nullable=False),
        sa.Column('report_type', sa.String, default='nightly'),  # nightly, on_demand, upload
        sa.Column('status', sa.String, default='generating'),  # generating, completed, failed
        sa.Column('total_holes', sa.Integer, default=0),
        sa.Column('total_issues', sa.Integer, default=0),
        sa.Column('error_count', sa.Integer, default=0),
        sa.Column('warning_count', sa.Integer, default=0),
        sa.Column('report_path', sa.String),  # S3 path to report files
        sa.Column('summary', sa.JSON),  # Report summary statistics
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('created_by', postgresql.UUID(as_uuid=True)),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
    )
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_collars_geom ON drill_collars USING GIST (geom)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_collars_hole_id ON drill_collars (hole_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_collars_org_id ON drill_collars (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_collars_project_id ON drill_collars (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_collars_start_date ON drill_collars (start_date)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_surveys_hole_id ON drill_surveys (hole_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_surveys_depth ON drill_surveys (depth)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_surveys_org_id ON drill_surveys (org_id)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_intervals_hole_id ON drill_intervals (hole_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_intervals_from_to ON drill_intervals (from_m, to_m)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_intervals_lith_code ON drill_intervals (lith_code)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_intervals_org_id ON drill_intervals (org_id)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_assays_hole_id ON drill_assays (hole_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_assays_from_to ON drill_assays (from_m, to_m)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_assays_element ON drill_assays (element)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_assays_org_id ON drill_assays (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_drill_assays_batch ON drill_assays (batch)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_rules_type ON qa_rules (rule_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_rules_active ON qa_rules (is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_rules_org_id ON qa_rules (org_id)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_results_rule_id ON qa_results (rule_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_results_hole_id ON qa_results (hole_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_results_severity ON qa_results (severity)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_results_status ON qa_results (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_results_created_at ON qa_results (created_at)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_reports_type ON qa_reports (report_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_reports_status ON qa_reports (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_reports_created_at ON qa_reports (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_qa_reports_org_id ON qa_reports (org_id)")
    
    # Enable RLS on tables
    op.execute("ALTER TABLE drill_collars ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE drill_surveys ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE drill_intervals ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE drill_assays ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE qa_rules ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE qa_results ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY")
    
    # Create RLS policies
    op.execute("""
        CREATE POLICY drill_collars_org_access ON drill_collars
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY drill_surveys_org_access ON drill_surveys
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY drill_intervals_org_access ON drill_intervals
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY drill_assays_org_access ON drill_assays
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY qa_rules_org_access ON qa_rules
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY qa_results_org_access ON qa_results
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY qa_reports_org_access ON qa_reports
        FOR ALL USING (
            org_id = COALESCE(
                current_setting('app.current_org_id', true)::UUID,
                (SELECT org_id FROM project_members pm 
                 JOIN projects p ON pm.project_id = p.id 
                 WHERE pm.user_id = auth.uid() LIMIT 1)
            )
        )
    """)


def downgrade() -> None:
    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS qa_reports_org_access ON qa_reports")
    op.execute("DROP POLICY IF EXISTS qa_results_org_access ON qa_results")
    op.execute("DROP POLICY IF EXISTS qa_rules_org_access ON qa_rules")
    op.execute("DROP POLICY IF EXISTS drill_assays_org_access ON drill_assays")
    op.execute("DROP POLICY IF EXISTS drill_intervals_org_access ON drill_intervals")
    op.execute("DROP POLICY IF EXISTS drill_surveys_org_access ON drill_surveys")
    op.execute("DROP POLICY IF EXISTS drill_collars_org_access ON drill_collars")
    
    # Drop tables
    op.drop_table('qa_reports')
    op.drop_table('qa_results')
    op.drop_table('qa_rules')
    op.drop_table('drill_assays')
    op.drop_table('drill_intervals')
    op.drop_table('drill_surveys')
    op.drop_table('drill_collars')