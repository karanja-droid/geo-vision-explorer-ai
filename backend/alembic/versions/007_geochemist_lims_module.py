"""Geochemist/LIMS module tables

Revision ID: 007_geochemist_lims_module
Revises: 006_role_based_modules
Create Date: 2025-01-14 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '007_geochemist_lims_module'
down_revision = '006_role_based_modules'
branch_labels = None
depends_on = None

def upgrade():
    # Sample Registration table
    op.create_table('sample_registrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('sample_id', sa.String(50), nullable=False),
        sa.Column('sample_type', sa.String(50), nullable=False),  # rock, soil, stream_sediment, drill_core, etc.
        sa.Column('location', sa.Text, nullable=False),  # GeoJSON Point
        sa.Column('elevation', sa.Float, nullable=True),
        sa.Column('sample_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('collected_by', sa.String(100), nullable=False),
        sa.Column('sample_weight', sa.Float, nullable=True),  # kg
        sa.Column('sample_description', sa.Text, nullable=True),
        sa.Column('preparation_method', sa.String(100), nullable=True),
        sa.Column('analytical_method', sa.String(100), nullable=True),
        sa.Column('laboratory', sa.String(100), nullable=True),
        sa.Column('batch_id', sa.String(50), nullable=True),
        sa.Column('chain_of_custody', postgresql.JSONB, nullable=True),
        sa.Column('qc_type', sa.String(20), nullable=True),  # standard, blank, duplicate, field_duplicate
        sa.Column('parent_sample_id', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='registered'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_sample_registrations_org_project', 'org_id', 'project_id'),
        sa.Index('idx_sample_registrations_sample_id', 'sample_id'),
        sa.Index('idx_sample_registrations_batch', 'batch_id'),
        sa.UniqueConstraint('org_id', 'sample_id', name='uq_sample_registrations_org_sample_id')
    )

    # Assay Results table
    op.create_table('assay_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('sample_registration_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('sample_registrations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sample_id', sa.String(50), nullable=False),
        sa.Column('element', sa.String(10), nullable=False),  # Au, Ag, Cu, Pb, Zn, etc.
        sa.Column('value', sa.Float, nullable=True),
        sa.Column('unit', sa.String(10), nullable=False),  # ppm, ppb, %, g/t, oz/t
        sa.Column('detection_limit', sa.Float, nullable=True),
        sa.Column('method', sa.String(50), nullable=True),  # FA-AAS, ICP-MS, XRF, etc.
        sa.Column('laboratory', sa.String(100), nullable=False),
        sa.Column('batch_id', sa.String(50), nullable=True),
        sa.Column('certificate_number', sa.String(50), nullable=True),
        sa.Column('analysis_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reported_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('qc_flag', sa.String(20), nullable=True),  # pass, fail, warning
        sa.Column('qc_notes', sa.Text, nullable=True),
        sa.Column('over_limit', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_assay_results_org_project', 'org_id', 'project_id'),
        sa.Index('idx_assay_results_sample_id', 'sample_id'),
        sa.Index('idx_assay_results_element', 'element'),
        sa.Index('idx_assay_results_batch', 'batch_id'),
        sa.UniqueConstraint('sample_registration_id', 'element', 'method', name='uq_assay_results_sample_element_method')
    )

    # QC Standards table
    op.create_table('qc_standards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('standard_id', sa.String(50), nullable=False),
        sa.Column('standard_type', sa.String(20), nullable=False),  # crm, blank, duplicate
        sa.Column('supplier', sa.String(100), nullable=True),
        sa.Column('matrix', sa.String(50), nullable=True),
        sa.Column('certified_values', postgresql.JSONB, nullable=False),  # {element: {value, uncertainty, unit}}
        sa.Column('acceptable_ranges', postgresql.JSONB, nullable=True),  # {element: {min, max, unit}}
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_qc_standards_org', 'org_id'),
        sa.Index('idx_qc_standards_standard_id', 'standard_id'),
        sa.UniqueConstraint('org_id', 'standard_id', name='uq_qc_standards_org_standard_id')
    )

    # QC Results table
    op.create_table('qc_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('qc_standard_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('qc_standards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sample_registration_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('sample_registrations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('batch_id', sa.String(50), nullable=False),
        sa.Column('element', sa.String(10), nullable=False),
        sa.Column('measured_value', sa.Float, nullable=True),
        sa.Column('certified_value', sa.Float, nullable=False),
        sa.Column('unit', sa.String(10), nullable=False),
        sa.Column('percent_difference', sa.Float, nullable=True),
        sa.Column('z_score', sa.Float, nullable=True),
        sa.Column('pass_fail', sa.String(10), nullable=False),  # pass, fail, warning
        sa.Column('analysis_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('laboratory', sa.String(100), nullable=False),
        sa.Column('method', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_qc_results_org_project', 'org_id', 'project_id'),
        sa.Index('idx_qc_results_batch', 'batch_id'),
        sa.Index('idx_qc_results_element', 'element'),
        sa.Index('idx_qc_results_pass_fail', 'pass_fail')
    )

    # Laboratory Performance table
    op.create_table('laboratory_performance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('laboratory', sa.String(100), nullable=False),
        sa.Column('reporting_period', sa.String(20), nullable=False),  # YYYY-MM format
        sa.Column('samples_submitted', sa.Integer, nullable=False, server_default='0'),
        sa.Column('samples_completed', sa.Integer, nullable=False, server_default='0'),
        sa.Column('samples_pending', sa.Integer, nullable=False, server_default='0'),
        sa.Column('average_tat_days', sa.Float, nullable=True),  # turnaround time
        sa.Column('qc_pass_rate', sa.Float, nullable=True),  # percentage
        sa.Column('cost_per_sample', sa.Float, nullable=True),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('performance_score', sa.Float, nullable=True),  # 0-100
        sa.Column('issues_reported', sa.Integer, nullable=False, server_default='0'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_laboratory_performance_org', 'org_id'),
        sa.Index('idx_laboratory_performance_lab', 'laboratory'),
        sa.Index('idx_laboratory_performance_period', 'reporting_period'),
        sa.UniqueConstraint('org_id', 'laboratory', 'reporting_period', name='uq_lab_performance_org_lab_period')
    )

    # Enable RLS on all tables
    tables = [
        'sample_registrations', 'assay_results', 'qc_standards', 
        'qc_results', 'laboratory_performance'
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
        'laboratory_performance', 'qc_results', 'qc_standards',
        'assay_results', 'sample_registrations'
    ]
    
    for table in tables:
        op.drop_table(table)