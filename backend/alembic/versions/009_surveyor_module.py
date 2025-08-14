"""Surveyor module tables

Revision ID: 009_surveyor_module
Revises: 008_geophysicist_rs_module
Create Date: 2025-01-14 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '009_surveyor_module'
down_revision = '008_geophysicist_rs_module'
branch_labels = None
depends_on = None

def upgrade():
    # Survey Control Points table
    op.create_table('survey_control_points',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('point_id', sa.String(50), nullable=False),
        sa.Column('point_type', sa.String(20), nullable=False),  # primary, secondary, temporary
        sa.Column('coordinate_system', sa.String(50), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('elevation', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('accuracy_horizontal', sa.Float, nullable=True),  # metres
        sa.Column('accuracy_vertical', sa.Float, nullable=True),  # metres
        sa.Column('survey_method', sa.String(50), nullable=False),  # DGPS, RTK, Total Station, etc.
        sa.Column('equipment_used', sa.String(100), nullable=True),
        sa.Column('survey_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('surveyor', sa.String(100), nullable=False),
        sa.Column('benchmark_reference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_survey_control_points_org_project', 'org_id', 'project_id'),
        sa.Index('idx_survey_control_points_point_id', 'point_id'),
        sa.Index('idx_survey_control_points_type', 'point_type'),
        sa.UniqueConstraint('org_id', 'point_id', name='uq_survey_control_points_org_point_id')
    )

    # Collar Surveys table
    op.create_table('collar_surveys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('collar_id', sa.String(50), nullable=False),
        sa.Column('drill_plan_id', postgresql.UUID(as_uuid=True), nullable=True),  # Link to drill plan if exists
        sa.Column('coordinate_system', sa.String(50), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('elevation', sa.Float, nullable=False),
        sa.Column('longitude', sa.Float, nullable=False),
        sa.Column('latitude', sa.Float, nullable=False),
        sa.Column('accuracy_horizontal', sa.Float, nullable=True),  # metres
        sa.Column('accuracy_vertical', sa.Float, nullable=True),  # metres
        sa.Column('survey_method', sa.String(50), nullable=False),
        sa.Column('equipment_used', sa.String(100), nullable=True),
        sa.Column('survey_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('surveyor', sa.String(100), nullable=False),
        sa.Column('collar_azimuth', sa.Float, nullable=True),  # degrees
        sa.Column('collar_dip', sa.Float, nullable=True),  # degrees
        sa.Column('collar_depth', sa.Float, nullable=True),  # metres
        sa.Column('collar_diameter', sa.Float, nullable=True),  # mm
        sa.Column('casing_details', sa.Text, nullable=True),
        sa.Column('access_notes', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='surveyed'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_collar_surveys_org_project', 'org_id', 'project_id'),
        sa.Index('idx_collar_surveys_collar_id', 'collar_id'),
        sa.Index('idx_collar_surveys_drill_plan', 'drill_plan_id'),
        sa.UniqueConstraint('org_id', 'collar_id', name='uq_collar_surveys_org_collar_id')
    )

    # Topographic Surveys table
    op.create_table('topographic_surveys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('survey_name', sa.String(100), nullable=False),
        sa.Column('survey_type', sa.String(50), nullable=False),  # drone, terrestrial, lidar, photogrammetry
        sa.Column('survey_area', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('survey_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('surveyor', sa.String(100), nullable=False),
        sa.Column('equipment_used', sa.String(100), nullable=False),
        sa.Column('flight_height', sa.Float, nullable=True),  # metres (for drone/aerial)
        sa.Column('ground_sample_distance', sa.Float, nullable=True),  # cm/pixel
        sa.Column('point_density', sa.Float, nullable=True),  # points/m² (for lidar)
        sa.Column('coordinate_system', sa.String(50), nullable=False),
        sa.Column('vertical_datum', sa.String(50), nullable=True),
        sa.Column('accuracy_horizontal', sa.Float, nullable=True),  # metres
        sa.Column('accuracy_vertical', sa.Float, nullable=True),  # metres
        sa.Column('deliverables', postgresql.JSONB, nullable=True),  # Array of deliverable types
        sa.Column('file_paths', postgresql.JSONB, nullable=True),  # Array of file paths
        sa.Column('processing_software', sa.String(100), nullable=True),
        sa.Column('quality_metrics', postgresql.JSONB, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_topographic_surveys_org_project', 'org_id', 'project_id'),
        sa.Index('idx_topographic_surveys_type', 'survey_type'),
        sa.Index('idx_topographic_surveys_date', 'survey_date')
    )

    # Volume Calculations table
    op.create_table('volume_calculations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('calculation_name', sa.String(100), nullable=False),
        sa.Column('calculation_type', sa.String(50), nullable=False),  # stockpile, pit, cut_fill, waste_dump
        sa.Column('area_geometry', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('base_surface_id', postgresql.UUID(as_uuid=True), nullable=True),  # Reference to topographic survey
        sa.Column('comparison_surface_id', postgresql.UUID(as_uuid=True), nullable=True),  # For change detection
        sa.Column('calculation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('calculated_by', sa.String(100), nullable=False),
        sa.Column('volume_cubic_metres', sa.Float, nullable=False),
        sa.Column('area_square_metres', sa.Float, nullable=False),
        sa.Column('average_height', sa.Float, nullable=True),  # metres
        sa.Column('max_height', sa.Float, nullable=True),  # metres
        sa.Column('min_height', sa.Float, nullable=True),  # metres
        sa.Column('calculation_method', sa.String(50), nullable=False),  # triangulation, grid, contour
        sa.Column('accuracy_estimate', sa.Float, nullable=True),  # percentage
        sa.Column('material_type', sa.String(50), nullable=True),
        sa.Column('bulk_density', sa.Float, nullable=True),  # tonnes/m³
        sa.Column('tonnage_estimate', sa.Float, nullable=True),  # tonnes
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_volume_calculations_org_project', 'org_id', 'project_id'),
        sa.Index('idx_volume_calculations_type', 'calculation_type'),
        sa.Index('idx_volume_calculations_date', 'calculation_date')
    )

    # Survey Adjustments table
    op.create_table('survey_adjustments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('adjustment_name', sa.String(100), nullable=False),
        sa.Column('adjustment_type', sa.String(50), nullable=False),  # least_squares, compass_rule, transit_rule
        sa.Column('control_points', postgresql.JSONB, nullable=False),  # Array of control point IDs
        sa.Column('observed_points', postgresql.JSONB, nullable=False),  # Array of observed point data
        sa.Column('adjustment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('adjusted_by', sa.String(100), nullable=False),
        sa.Column('software_used', sa.String(100), nullable=True),
        sa.Column('closure_error_x', sa.Float, nullable=True),  # metres
        sa.Column('closure_error_y', sa.Float, nullable=True),  # metres
        sa.Column('closure_error_total', sa.Float, nullable=True),  # metres
        sa.Column('precision_ratio', sa.String(20), nullable=True),  # e.g., "1:10000"
        sa.Column('standard_deviation', sa.Float, nullable=True),  # metres
        sa.Column('chi_square_test', sa.Float, nullable=True),
        sa.Column('degrees_of_freedom', sa.Integer, nullable=True),
        sa.Column('adjustment_results', postgresql.JSONB, nullable=True),  # Detailed results
        sa.Column('quality_assessment', sa.Text, nullable=True),
        sa.Column('approved', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('approved_by', sa.String(100), nullable=True),
        sa.Column('approval_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_survey_adjustments_org_project', 'org_id', 'project_id'),
        sa.Index('idx_survey_adjustments_type', 'adjustment_type'),
        sa.Index('idx_survey_adjustments_approved', 'approved')
    )

    # Enable RLS on all tables
    tables = [
        'survey_control_points', 'collar_surveys', 'topographic_surveys',
        'volume_calculations', 'survey_adjustments'
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
        'survey_adjustments', 'volume_calculations', 'topographic_surveys',
        'collar_surveys', 'survey_control_points'
    ]
    
    for table in tables:
        op.drop_table(table)