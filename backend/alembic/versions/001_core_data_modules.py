"""Core data modules foundation

Revision ID: 001_core_data_modules
Revises: 
Create Date: 2025-01-13 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '001_core_data_modules'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
    
    # Create enum types
    op.execute("""
        CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential');
        CREATE TYPE export_status AS ENUM ('pending', 'processing', 'completed', 'failed');
        CREATE TYPE export_format AS ENUM ('csv', 'xlsx', 'json', 'gpkg', 'geojson', 'pdf', 'png', 'cog', 'mvt');
    """)
    
    # Organizations table
    op.create_table('organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Projects table
    op.create_table('projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('countries', postgresql.ARRAY(sa.String(2)), nullable=False, default=[]),
        sa.Column('roles', postgresql.ARRAY(sa.String(50)), nullable=False, default=[]),
        sa.Column('aoi', sa.Text),  # PostGIS geometry as text
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('org_id', 'slug', name='unique_project_slug_per_org')
    )
    
    # Add PostGIS geometry column for AOI
    op.execute("SELECT AddGeometryColumn('projects', 'aoi_geom', 4326, 'POLYGON', 2);")
    op.execute("CREATE INDEX idx_projects_aoi_geom ON projects USING GIST (aoi_geom);")
    
    # Provenance tracking table
    op.create_table('data_provenance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('source', sa.String(255), nullable=False),
        sa.Column('license', sa.String(255)),
        sa.Column('collected_at', sa.DateTime(timezone=True)),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Exports tracking table
    op.create_table('exports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('module', sa.String(50), nullable=False),
        sa.Column('format', sa.Enum('csv', 'xlsx', 'json', 'gpkg', 'geojson', 'pdf', 'png', 'cog', 'mvt', name='export_format'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'processing', 'completed', 'failed', name='export_status'), default='pending'),
        sa.Column('file_size_bytes', sa.BigInteger),
        sa.Column('s3_key', sa.String(500)),
        sa.Column('signed_url', sa.Text),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.Column('error_message', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True))
    )
    
    # STAC collections table
    op.create_table('stac_collections',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('keywords', postgresql.ARRAY(sa.String(100))),
        sa.Column('license', sa.String(255)),
        sa.Column('extent_spatial', postgresql.JSONB),
        sa.Column('extent_temporal', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # STAC items table
    op.create_table('stac_items',
        sa.Column('id', sa.String(255), primary_key=True),
        sa.Column('collection_id', sa.String(255), sa.ForeignKey('stac_collections.id'), nullable=False),
        sa.Column('bbox', postgresql.ARRAY(sa.Float), nullable=False),
        sa.Column('properties', postgresql.JSONB, nullable=False),
        sa.Column('assets', postgresql.JSONB, nullable=False),
        sa.Column('links', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for STAC items
    op.execute("SELECT AddGeometryColumn('stac_items', 'geometry', 4326, 'GEOMETRY', 2);")
    op.execute("CREATE INDEX idx_stac_items_geometry ON stac_items USING GIST (geometry);")
    
    # Feature flags table
    op.create_table('feature_flags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean, default=False),
        sa.Column('description', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Insert default feature flags
    op.execute("""
        INSERT INTO feature_flags (name, enabled, description) VALUES
        ('FEATURE_PROJECT_SETUP', true, 'Project and organization setup module'),
        ('FEATURE_SPATIAL_VECTOR', true, 'Spatial vector data ingest module'),
        ('FEATURE_SPATIAL_RASTER', true, 'Spatial raster data ingest module'),
        ('FEATURE_REMOTE_SENSING', true, 'Remote sensing data processing'),
        ('FEATURE_GEOLOGY_MAPPING', true, 'Geology mapping and field data'),
        ('FEATURE_GEOCHEMISTRY', true, 'Geochemistry and LIMS integration'),
        ('FEATURE_DRILLING', true, 'Drilling data management'),
        ('FEATURE_PROSPECTIVITY', true, 'Prospectivity and AI analysis'),
        ('FEATURE_ACTIVE_LEARNING', true, 'Active learning labels'),
        ('FEATURE_RESOURCE_MODELING', true, 'Resource modeling lite'),
        ('FEATURE_GEOTECH_HYDRO', true, 'Geotech and hydro data'),
        ('FEATURE_ESG_PERMITS', true, 'ESG and permits management'),
        ('FEATURE_HSE_INCIDENTS', true, 'HSE and incidents tracking'),
        ('FEATURE_LOGISTICS', true, 'Logistics and inventory'),
        ('FEATURE_FINANCE', true, 'Finance and portfolio'),
        ('FEATURE_MOBILE_FIELD', true, 'Mobile field data collection'),
        ('FEATURE_REPORTING', true, 'Reporting and dashboards'),
        ('FEATURE_ADMIN_BILLING', true, 'Admin and billing'),
        ('FEATURE_ADOBE_VIEW', true, 'Adobe PDF viewer integration');
    """)
    
    # Enable RLS on all tables
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE projects ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE exports ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE stac_collections ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE stac_items ENABLE ROW LEVEL SECURITY;")
    
    # Basic RLS policies (org/project scoped)
    op.execute("""
        CREATE POLICY org_isolation ON organizations
        FOR ALL USING (id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY project_isolation ON projects
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY export_isolation ON exports
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY stac_collection_isolation ON stac_collections
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY stac_item_isolation ON stac_items
        FOR ALL USING (collection_id IN (
            SELECT id FROM stac_collections WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
    """)

def downgrade():
    # Drop tables in reverse order
    op.drop_table('stac_items')
    op.drop_table('stac_collections')
    op.drop_table('exports')
    op.drop_table('data_provenance')
    op.drop_table('projects')
    op.drop_table('organizations')
    op.drop_table('feature_flags')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS export_format;")
    op.execute("DROP TYPE IF EXISTS export_status;")
    op.execute("DROP TYPE IF EXISTS data_classification;")