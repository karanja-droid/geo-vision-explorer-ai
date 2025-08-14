"""Role-based data entry and reports modules

Revision ID: 006_role_based_modules
Revises: 005_prospectivity_ai_module
Create Date: 2025-01-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '006_role_based_modules'
down_revision = '005_prospectivity_ai_module'
branch_labels = None
depends_on = None

def upgrade():
    # Export jobs tracking table
    op.create_table('export_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', sa.String(255), nullable=False, unique=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('module', sa.String(50), nullable=False),
        sa.Column('report_type', sa.String(100), nullable=False),
        sa.Column('format', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('parameters', postgresql.JSONB, nullable=True),
        sa.Column('file_url', sa.Text, nullable=True),
        sa.Column('file_size', sa.BigInteger, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Index('idx_export_jobs_user_id', 'user_id'),
        sa.Index('idx_export_jobs_org_id', 'org_id'),
        sa.Index('idx_export_jobs_status', 'status'),
        sa.Index('idx_export_jobs_created_at', 'created_at')
    )

    # Executive module tables
    op.create_table('executive_budgets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('budget_type', sa.String(50), nullable=False),  # exploration, development, operations
        sa.Column('fiscal_year', sa.Integer, nullable=False),
        sa.Column('approved_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('spent_amount', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('approval_status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_executive_budgets_org_project', 'org_id', 'project_id'),
        sa.Index('idx_executive_budgets_fiscal_year', 'fiscal_year')
    )

    op.create_table('executive_esg_signoffs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('esg_category', sa.String(50), nullable=False),  # environmental, social, governance
        sa.Column('requirement_type', sa.String(100), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('signed_off_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('signed_off_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('compliance_notes', sa.Text, nullable=True),
        sa.Column('risk_level', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_esg_signoffs_org_project', 'org_id', 'project_id'),
        sa.Index('idx_esg_signoffs_status', 'status'),
        sa.Index('idx_esg_signoffs_due_date', 'due_date')
    )

    # Geologist module tables (extend existing geology tables)
    op.create_table('field_observations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('observation_type', sa.String(50), nullable=False),  # outcrop, structure, lithology
        sa.Column('location', sa.Text, nullable=False),  # GeoJSON Point
        sa.Column('elevation', sa.Float, nullable=True),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('lithology', sa.String(100), nullable=True),
        sa.Column('structure_type', sa.String(50), nullable=True),
        sa.Column('strike', sa.Float, nullable=True),
        sa.Column('dip', sa.Float, nullable=True),
        sa.Column('mineralization', sa.Text, nullable=True),
        sa.Column('alteration', sa.Text, nullable=True),
        sa.Column('photos', postgresql.JSONB, nullable=True),
        sa.Column('geologist', sa.String(100), nullable=False),
        sa.Column('observation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('weather_conditions', sa.String(100), nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_field_observations_org_project', 'org_id', 'project_id'),
        sa.Index('idx_field_observations_type', 'observation_type'),
        sa.Index('idx_field_observations_date', 'observation_date')
    )

    op.create_table('geological_targets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('target_name', sa.String(100), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),  # drill, geophysics, geochemistry
        sa.Column('geometry', sa.Text, nullable=False),  # GeoJSON Polygon/Point
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('rationale', sa.Text, nullable=False),
        sa.Column('commodity', sa.String(50), nullable=False),
        sa.Column('confidence_level', sa.Float, nullable=True),  # 0-1
        sa.Column('prospectivity_score', sa.Float, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('target_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_geological_targets_org_project', 'org_id', 'project_id'),
        sa.Index('idx_geological_targets_priority', 'priority'),
        sa.Index('idx_geological_targets_status', 'status')
    )

    # Driller module tables (extend existing drilling tables)
    op.create_table('drill_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('plan_name', sa.String(100), nullable=False),
        sa.Column('drill_type', sa.String(50), nullable=False),  # diamond, rc, aircore
        sa.Column('collar_location', sa.Text, nullable=False),  # GeoJSON Point
        sa.Column('azimuth', sa.Float, nullable=False),
        sa.Column('dip', sa.Float, nullable=False),
        sa.Column('target_depth', sa.Float, nullable=False),
        sa.Column('planned_start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('estimated_duration_days', sa.Integer, nullable=False),
        sa.Column('budget_estimate', sa.Numeric(12, 2), nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('drilling_contractor', sa.String(100), nullable=True),
        sa.Column('rig_type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='planned'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_drill_plans_org_project', 'org_id', 'project_id'),
        sa.Index('idx_drill_plans_status', 'status'),
        sa.Index('idx_drill_plans_start_date', 'planned_start_date')
    )

    op.create_table('daily_drilling_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('drill_plan_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('report_date', sa.Date, nullable=False),
        sa.Column('shift', sa.String(20), nullable=False),  # day, night
        sa.Column('metres_drilled', sa.Float, nullable=False, server_default='0'),
        sa.Column('total_depth', sa.Float, nullable=False),
        sa.Column('core_recovery_percent', sa.Float, nullable=True),
        sa.Column('drilling_fluid', sa.String(50), nullable=True),
        sa.Column('downtime_hours', sa.Float, nullable=False, server_default='0'),
        sa.Column('downtime_reason', sa.Text, nullable=True),
        sa.Column('rop_average', sa.Float, nullable=True),  # rate of penetration
        sa.Column('consumables_used', postgresql.JSONB, nullable=True),
        sa.Column('safety_incidents', sa.Integer, nullable=False, server_default='0'),
        sa.Column('weather_conditions', sa.String(100), nullable=True),
        sa.Column('crew_notes', sa.Text, nullable=True),
        sa.Column('driller_name', sa.String(100), nullable=False),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['drill_plan_id'], ['drill_plans.id'], ondelete='CASCADE'),
        sa.Index('idx_daily_drilling_org_project', 'org_id', 'project_id'),
        sa.Index('idx_daily_drilling_plan_date', 'drill_plan_id', 'report_date'),
        sa.UniqueConstraint('drill_plan_id', 'report_date', 'shift', name='uq_daily_drilling_plan_date_shift')
    )

    # Enable RLS on all tables
    tables = [
        'export_jobs', 'executive_budgets', 'executive_esg_signoffs',
        'field_observations', 'geological_targets', 'drill_plans', 'daily_drilling_reports'
    ]
    
    for table in tables:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        
        # Basic RLS policy for org membership
        op.execute(f'''
            CREATE POLICY {table}_org_policy ON {table}
            FOR ALL TO authenticated
            USING (org_id IN (
                SELECT org_id FROM user_organizations 
                WHERE user_id = auth.uid() AND status = 'active'
            ))
        ''')

def downgrade():
    # Drop tables in reverse order
    tables = [
        'daily_drilling_reports', 'drill_plans', 'geological_targets',
        'field_observations', 'executive_esg_signoffs', 'executive_budgets', 'export_jobs'
    ]
    
    for table in tables:
        op.drop_table(table)