"""Drilling and geochemistry modules

Revision ID: 003_drilling_geochemistry_modules
Revises: 002_geology_spatial_modules
Create Date: 2025-01-13 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '003_drilling_geochemistry_modules'
down_revision = '002_geology_spatial_modules'
branch_labels = None
depends_on = None

def upgrade():
    # Drill collars table
    op.create_table('drill_collars',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
        sa.Column('hole_id', sa.String(50), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('elevation', sa.Float, nullable=False),
        sa.Column('total_depth', sa.Float, nullable=False),
        sa.Column('azimuth', sa.Float),
        sa.Column('dip', sa.Float),
        sa.Column('drill_date', sa.Date),
        sa.Column('drill_type', sa.String(50)),  # RC, DD, RAB, etc.
        sa.Column('contractor', sa.String(100)),
        sa.Column('status', sa.String(20)),  # planned, drilling, completed, abandoned
        sa.Column('attributes', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('org_id', 'project_id', 'hole_id', name='unique_hole_id_per_project')
    )
    
    # Add PostGIS geometry column for collar location
    op.execute("SELECT AddGeometryColumn('drill_collars', 'geom', 4326, 'POINT', 2);")
    op.execute("CREATE INDEX idx_drill_collars_geom ON drill_collars USING GIST (geom);")
    
    # Drill surveys table (downhole survey data)
    op.create_table('drill_surveys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('collar_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('drill_collars.id'), nullable=False),
        sa.Column('depth_m', sa.Float, nullable=False),
        sa.Column('azimuth', sa.Float, nullable=False),
        sa.Column('dip', sa.Float, nullable=False),
        sa.Column('survey_method', sa.String(50)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('collar_id', 'depth_m', name='unique_survey_depth_per_hole')
    )
    
    # Drill intervals table (geological logging)
    op.create_table('drill_intervals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('collar_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('drill_collars.id'), nullable=False),
        sa.Column('from_m', sa.Float, nullable=False),
        sa.Column('to_m', sa.Float, nullable=False),
        sa.Column('lithology', sa.String(100)),
        sa.Column('alteration', sa.String(100)),
        sa.Column('mineralization', sa.String(100)),
        sa.Column('recovery_percent', sa.Float),
        sa.Column('rqd_percent', sa.Float),
        sa.Column('description', sa.Text),
        sa.Column('geologist', sa.String(100)),
        sa.Column('logged_date', sa.Date),
        sa.Column('attributes', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint('from_m < to_m', name='check_interval_order')
    )
    
    # Drill assays table
    op.create_table('drill_assays',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('collar_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('drill_collars.id'), nullable=False),
        sa.Column('from_m', sa.Float, nullable=False),
        sa.Column('to_m', sa.Float, nullable=False),
        sa.Column('sample_id', sa.String(50)),
        sa.Column('batch_id', sa.String(50)),
        sa.Column('lab', sa.String(100)),
        sa.Column('assay_date', sa.Date),
        sa.Column('elements', postgresql.JSONB, nullable=False),  # {element: {value, unit, detection_limit}}
        sa.Column('qc_flags', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.CheckConstraint('from_m < to_m', name='check_assay_interval_order')
    )
    
    # Geochemistry samples table
    op.create_table('geochem_samples',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
        sa.Column('sample_id', sa.String(50), nullable=False),
        sa.Column('sample_type', sa.String(50), nullable=False),  # soil, rock, stream_sediment, etc.
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('elevation', sa.Float),
        sa.Column('collection_date', sa.Date),
        sa.Column('collector', sa.String(100)),
        sa.Column('sample_weight_kg', sa.Float),
        sa.Column('description', sa.Text),
        sa.Column('attributes', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('org_id', 'project_id', 'sample_id', name='unique_sample_id_per_project')
    )
    
    # Add PostGIS geometry column for sample location
    op.execute("SELECT AddGeometryColumn('geochem_samples', 'geom', 4326, 'POINT', 2);")
    op.execute("CREATE INDEX idx_geochem_samples_geom ON geochem_samples USING GIST (geom);")
    
    # Geochemistry results table
    op.create_table('geochem_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('sample_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('geochem_samples.id'), nullable=False),
        sa.Column('batch_id', sa.String(50)),
        sa.Column('lab', sa.String(100), nullable=False),
        sa.Column('analysis_date', sa.Date),
        sa.Column('method', sa.String(100)),
        sa.Column('elements', postgresql.JSONB, nullable=False),  # {element: {value, unit, detection_limit, qualifier}}
        sa.Column('qc_flags', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Chain of custody batches table
    op.create_table('coc_batches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('batch_id', sa.String(50), nullable=False),
        sa.Column('lab', sa.String(100), nullable=False),
        sa.Column('submitted_date', sa.Date, nullable=False),
        sa.Column('received_date', sa.Date),
        sa.Column('completed_date', sa.Date),
        sa.Column('sample_count', sa.Integer, nullable=False),
        sa.Column('qc_sample_count', sa.Integer, default=0),
        sa.Column('status', sa.String(20), default='submitted'),  # submitted, received, in_progress, completed
        sa.Column('notes', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('org_id', 'project_id', 'batch_id', name='unique_batch_id_per_project')
    )
    
    # QC rules table
    op.create_table('qc_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('element', sa.String(10), nullable=False),
        sa.Column('standard_id', sa.String(50)),
        sa.Column('expected_value', sa.Float),
        sa.Column('tolerance_percent', sa.Float, default=10.0),
        sa.Column('warning_limit', sa.Float, default=2.0),  # Z-score
        sa.Column('control_limit', sa.Float, default=3.0),  # Z-score
        sa.Column('active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # QC results table
    op.create_table('qc_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('batch_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('coc_batches.id'), nullable=False),
        sa.Column('qc_type', sa.String(20), nullable=False),  # standard, blank, duplicate
        sa.Column('element', sa.String(10), nullable=False),
        sa.Column('measured_value', sa.Float),
        sa.Column('expected_value', sa.Float),
        sa.Column('z_score', sa.Float),
        sa.Column('flag', sa.String(20)),  # pass, warning, fail
        sa.Column('notes', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Enable RLS on all new tables
    tables = ['drill_collars', 'drill_surveys', 'drill_intervals', 'drill_assays', 
              'geochem_samples', 'geochem_results', 'coc_batches', 'qc_rules', 'qc_results']
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    
    # RLS policies for drilling tables
    op.execute("""
        CREATE POLICY drill_collars_isolation ON drill_collars
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY drill_surveys_isolation ON drill_surveys
        FOR ALL USING (collar_id IN (
            SELECT id FROM drill_collars WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY drill_intervals_isolation ON drill_intervals
        FOR ALL USING (collar_id IN (
            SELECT id FROM drill_collars WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY drill_assays_isolation ON drill_assays
        FOR ALL USING (collar_id IN (
            SELECT id FROM drill_collars WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
    """)
    
    # RLS policies for geochemistry tables
    op.execute("""
        CREATE POLICY geochem_samples_isolation ON geochem_samples
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY geochem_results_isolation ON geochem_results
        FOR ALL USING (sample_id IN (
            SELECT id FROM geochem_samples WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY coc_batches_isolation ON coc_batches
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY qc_rules_isolation ON qc_rules
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY qc_results_isolation ON qc_results
        FOR ALL USING (batch_id IN (
            SELECT id FROM coc_batches WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
    """)
    
    # Create indexes for performance
    op.create_index('idx_drill_collars_hole_id', 'drill_collars', ['hole_id'])
    op.create_index('idx_drill_surveys_collar_depth', 'drill_surveys', ['collar_id', 'depth_m'])
    op.create_index('idx_drill_intervals_collar_from_to', 'drill_intervals', ['collar_id', 'from_m', 'to_m'])
    op.create_index('idx_drill_assays_collar_from_to', 'drill_assays', ['collar_id', 'from_m', 'to_m'])
    op.create_index('idx_geochem_samples_sample_id', 'geochem_samples', ['sample_id'])
    op.create_index('idx_geochem_results_sample_id', 'geochem_results', ['sample_id'])
    op.create_index('idx_coc_batches_batch_id', 'coc_batches', ['batch_id'])

def downgrade():
    # Drop tables in reverse order
    op.drop_table('qc_results')
    op.drop_table('qc_rules')
    op.drop_table('coc_batches')
    op.drop_table('geochem_results')
    op.drop_table('geochem_samples')
    op.drop_table('drill_assays')
    op.drop_table('drill_intervals')
    op.drop_table('drill_surveys')
    op.drop_table('drill_collars')