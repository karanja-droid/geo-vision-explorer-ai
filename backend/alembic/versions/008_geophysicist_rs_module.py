"""Geophysicist/Remote Sensing module tables

Revision ID: 008_geophysicist_rs_module
Revises: 007_geochemist_lims_module
Create Date: 2025-01-14 13:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '008_geophysicist_rs_module'
down_revision = '007_geochemist_lims_module'
branch_labels = None
depends_on = None

def upgrade():
    # Geophysical Surveys table
    op.create_table('geophysical_surveys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('survey_name', sa.String(100), nullable=False),
        sa.Column('survey_type', sa.String(50), nullable=False),  # magnetic, gravity, radiometric, IP, EM, seismic
        sa.Column('survey_area', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('line_spacing', sa.Float, nullable=True),  # metres
        sa.Column('station_spacing', sa.Float, nullable=True),  # metres
        sa.Column('flight_height', sa.Float, nullable=True),  # metres (for airborne)
        sa.Column('survey_date_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('survey_date_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('contractor', sa.String(100), nullable=True),
        sa.Column('equipment', sa.String(100), nullable=True),
        sa.Column('processing_level', sa.String(20), nullable=False, server_default='raw'),  # raw, processed, interpreted
        sa.Column('coordinate_system', sa.String(50), nullable=False, server_default='WGS84'),
        sa.Column('data_format', sa.String(20), nullable=True),  # XYZ, GDB, Geosoft, etc.
        sa.Column('file_paths', postgresql.JSONB, nullable=True),  # Array of file paths
        sa.Column('metadata', postgresql.JSONB, nullable=True),  # Survey-specific metadata
        sa.Column('status', sa.String(20), nullable=False, server_default='planned'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_geophysical_surveys_org_project', 'org_id', 'project_id'),
        sa.Index('idx_geophysical_surveys_type', 'survey_type'),
        sa.Index('idx_geophysical_surveys_status', 'status')
    )

    # Geophysical Anomalies table
    op.create_table('geophysical_anomalies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('survey_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('geophysical_surveys.id', ondelete='CASCADE'), nullable=False),
        sa.Column('anomaly_name', sa.String(100), nullable=False),
        sa.Column('anomaly_type', sa.String(50), nullable=False),  # magnetic_high, gravity_low, conductivity, etc.
        sa.Column('geometry', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('amplitude', sa.Float, nullable=True),
        sa.Column('amplitude_unit', sa.String(20), nullable=True),
        sa.Column('confidence_level', sa.Float, nullable=True),  # 0-1
        sa.Column('priority', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('interpretation', sa.Text, nullable=True),
        sa.Column('follow_up_required', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('follow_up_method', sa.String(50), nullable=True),
        sa.Column('interpreted_by', sa.String(100), nullable=False),
        sa.Column('interpretation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_geophysical_anomalies_org_project', 'org_id', 'project_id'),
        sa.Index('idx_geophysical_anomalies_survey', 'survey_id'),
        sa.Index('idx_geophysical_anomalies_type', 'anomaly_type'),
        sa.Index('idx_geophysical_anomalies_priority', 'priority')
    )

    # Remote Sensing Datasets table
    op.create_table('remote_sensing_datasets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('dataset_name', sa.String(100), nullable=False),
        sa.Column('sensor_type', sa.String(50), nullable=False),  # Landsat, Sentinel, ASTER, WorldView, etc.
        sa.Column('acquisition_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scene_id', sa.String(100), nullable=True),
        sa.Column('cloud_cover', sa.Float, nullable=True),  # percentage
        sa.Column('spatial_resolution', sa.Float, nullable=True),  # metres
        sa.Column('spectral_bands', postgresql.JSONB, nullable=True),  # Array of band information
        sa.Column('coverage_area', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('processing_level', sa.String(20), nullable=False, server_default='L1'),
        sa.Column('file_format', sa.String(20), nullable=True),  # GeoTIFF, HDF, etc.
        sa.Column('file_paths', postgresql.JSONB, nullable=True),  # Array of file paths
        sa.Column('metadata', postgresql.JSONB, nullable=True),  # Sensor-specific metadata
        sa.Column('indices_computed', postgresql.JSONB, nullable=True),  # Array of computed indices
        sa.Column('status', sa.String(20), nullable=False, server_default='acquired'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_remote_sensing_datasets_org_project', 'org_id', 'project_id'),
        sa.Index('idx_remote_sensing_datasets_sensor', 'sensor_type'),
        sa.Index('idx_remote_sensing_datasets_date', 'acquisition_date'),
        sa.Index('idx_remote_sensing_datasets_status', 'status')
    )

    # Processing Workflows table
    op.create_table('processing_workflows',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_name', sa.String(100), nullable=False),
        sa.Column('workflow_type', sa.String(50), nullable=False),  # geophysical, remote_sensing
        sa.Column('input_datasets', postgresql.JSONB, nullable=False),  # Array of dataset IDs
        sa.Column('processing_steps', postgresql.JSONB, nullable=False),  # Array of processing steps
        sa.Column('parameters', postgresql.JSONB, nullable=True),  # Processing parameters
        sa.Column('output_products', postgresql.JSONB, nullable=True),  # Array of output files
        sa.Column('status', sa.String(20), nullable=False, server_default='created'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_by', sa.String(100), nullable=False),
        sa.Column('processing_log', sa.Text, nullable=True),
        sa.Column('quality_metrics', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_processing_workflows_org_project', 'org_id', 'project_id'),
        sa.Index('idx_processing_workflows_type', 'workflow_type'),
        sa.Index('idx_processing_workflows_status', 'status')
    )

    # Interpretation Results table
    op.create_table('interpretation_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('interpretation_name', sa.String(100), nullable=False),
        sa.Column('data_type', sa.String(50), nullable=False),  # geophysical, remote_sensing
        sa.Column('source_datasets', postgresql.JSONB, nullable=False),  # Array of dataset IDs
        sa.Column('interpretation_method', sa.String(100), nullable=False),
        sa.Column('results', postgresql.JSONB, nullable=False),  # Interpretation results
        sa.Column('confidence_assessment', sa.Text, nullable=True),
        sa.Column('recommendations', sa.Text, nullable=True),
        sa.Column('interpreted_by', sa.String(100), nullable=False),
        sa.Column('reviewed_by', sa.String(100), nullable=True),
        sa.Column('interpretation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('review_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_interpretation_results_org_project', 'org_id', 'project_id'),
        sa.Index('idx_interpretation_results_type', 'data_type'),
        sa.Index('idx_interpretation_results_status', 'status')
    )

    # Enable RLS on all tables
    tables = [
        'geophysical_surveys', 'geophysical_anomalies', 'remote_sensing_datasets',
        'processing_workflows', 'interpretation_results'
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
        'interpretation_results', 'processing_workflows', 'remote_sensing_datasets',
        'geophysical_anomalies', 'geophysical_surveys'
    ]
    
    for table in tables:
        op.drop_table(table)