"""Geology and spatial data modules

Revision ID: 002_geology_spatial_modules
Revises: 001_core_data_modules
Create Date: 2025-01-13 10:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '002_geology_spatial_modules'
down_revision = '001_core_data_modules'
branch_labels = None
depends_on = None

def upgrade():
    # Create country-specific geology tables (example for common countries)
    countries = ['AU', 'CA', 'US', 'ZA', 'CL', 'PE', 'BR', 'MX', 'GH', 'TZ', 'ZM', 'CD']
    
    for cc in countries:
        # Geology layers table
        op.create_table(f'geology_{cc.lower()}',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
            sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('country_code', sa.String(2), nullable=False, default=cc),
            sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
            sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
            sa.Column('formation_name', sa.String(255)),
            sa.Column('lithology', sa.String(100)),
            sa.Column('age_min_ma', sa.Float),
            sa.Column('age_max_ma', sa.Float),
            sa.Column('description', sa.Text),
            sa.Column('attributes', postgresql.JSONB),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
        )
        
        # Add PostGIS geometry column
        op.execute(f"SELECT AddGeometryColumn('geology_{cc.lower()}', 'geom', 4326, 'MULTIPOLYGON', 2);")
        op.execute(f"CREATE INDEX idx_geology_{cc.lower()}_geom ON geology_{cc.lower()} USING GIST (geom);")
        
        # Structural geology table
        op.create_table(f'structures_{cc.lower()}',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
            sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('country_code', sa.String(2), nullable=False, default=cc),
            sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
            sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
            sa.Column('structure_type', sa.String(50)),  # fault, fold, joint, etc.
            sa.Column('strike', sa.Float),
            sa.Column('dip', sa.Float),
            sa.Column('confidence', sa.String(20)),
            sa.Column('attributes', postgresql.JSONB),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
        )
        
        # Add PostGIS geometry column for structures
        op.execute(f"SELECT AddGeometryColumn('structures_{cc.lower()}', 'geom', 4326, 'GEOMETRY', 2);")
        op.execute(f"CREATE INDEX idx_structures_{cc.lower()}_geom ON structures_{cc.lower()} USING GIST (geom);")
        
        # Mineral occurrences table
        op.create_table(f'occurrences_{cc.lower()}',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
            sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
            sa.Column('country_code', sa.String(2), nullable=False, default=cc),
            sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
            sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
            sa.Column('occurrence_name', sa.String(255)),
            sa.Column('commodity', sa.String(50)),
            sa.Column('deposit_type', sa.String(100)),
            sa.Column('status', sa.String(50)),  # prospect, resource, reserve, mine
            sa.Column('tonnage_mt', sa.Float),
            sa.Column('grade_percent', sa.Float),
            sa.Column('attributes', postgresql.JSONB),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
        )
        
        # Add PostGIS geometry column for occurrences
        op.execute(f"SELECT AddGeometryColumn('occurrences_{cc.lower()}', 'geom', 4326, 'POINT', 2);")
        op.execute(f"CREATE INDEX idx_occurrences_{cc.lower()}_geom ON occurrences_{cc.lower()} USING GIST (geom);")
        
        # Enable RLS on country-specific tables
        op.execute(f"ALTER TABLE geology_{cc.lower()} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE structures_{cc.lower()} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE occurrences_{cc.lower()} ENABLE ROW LEVEL SECURITY;")
        
        # RLS policies
        op.execute(f"""
            CREATE POLICY geology_{cc.lower()}_isolation ON geology_{cc.lower()}
            FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
            
            CREATE POLICY structures_{cc.lower()}_isolation ON structures_{cc.lower()}
            FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
            
            CREATE POLICY occurrences_{cc.lower()}_isolation ON occurrences_{cc.lower()}
            FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        """)
    
    # Raster assets table for geophysics and DEM
    op.create_table('raster_assets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
        sa.Column('asset_type', sa.String(50), nullable=False),  # mag, gravity, radiometric, dem, slope, etc.
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('crs', sa.String(50), nullable=False),
        sa.Column('pixel_size_x', sa.Float),
        sa.Column('pixel_size_y', sa.Float),
        sa.Column('nodata_value', sa.Float),
        sa.Column('units', sa.String(50)),
        sa.Column('s3_key', sa.String(500), nullable=False),
        sa.Column('cog_optimized', sa.Boolean, default=False),
        sa.Column('overviews_built', sa.Boolean, default=False),
        sa.Column('file_size_bytes', sa.BigInteger),
        sa.Column('bbox', postgresql.ARRAY(sa.Float)),  # [minx, miny, maxx, maxy]
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for raster footprint
    op.execute("SELECT AddGeometryColumn('raster_assets', 'footprint', 4326, 'POLYGON', 2);")
    op.execute("CREATE INDEX idx_raster_assets_footprint ON raster_assets USING GIST (footprint);")
    
    # Remote sensing data table
    op.create_table('remote_sensing',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
        sa.Column('satellite', sa.String(50), nullable=False),  # Sentinel-2, Landsat-8, etc.
        sa.Column('scene_id', sa.String(100), nullable=False),
        sa.Column('acquisition_date', sa.Date, nullable=False),
        sa.Column('cloud_cover_percent', sa.Float),
        sa.Column('season', sa.String(20)),  # wet, dry, spring, summer, etc.
        sa.Column('processing_level', sa.String(10)),  # L1C, L2A, etc.
        sa.Column('bands_available', postgresql.ARRAY(sa.String(10))),
        sa.Column('indices_computed', postgresql.ARRAY(sa.String(10))),  # NDVI, NDWI, NBR, etc.
        sa.Column('s3_key_composite', sa.String(500)),
        sa.Column('s3_key_indices', sa.String(500)),
        sa.Column('bbox', postgresql.ARRAY(sa.Float)),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for remote sensing footprint
    op.execute("SELECT AddGeometryColumn('remote_sensing', 'footprint', 4326, 'POLYGON', 2);")
    op.execute("CREATE INDEX idx_remote_sensing_footprint ON remote_sensing USING GIST (footprint);")
    
    # Enable RLS on new tables
    op.execute("ALTER TABLE raster_assets ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE remote_sensing ENABLE ROW LEVEL SECURITY;")
    
    # RLS policies
    op.execute("""
        CREATE POLICY raster_assets_isolation ON raster_assets
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY remote_sensing_isolation ON remote_sensing
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
    """)

def downgrade():
    # Drop remote sensing and raster tables
    op.drop_table('remote_sensing')
    op.drop_table('raster_assets')
    
    # Drop country-specific tables
    countries = ['AU', 'CA', 'US', 'ZA', 'CL', 'PE', 'BR', 'MX', 'GH', 'TZ', 'ZM', 'CD']
    for cc in countries:
        op.drop_table(f'occurrences_{cc.lower()}')
        op.drop_table(f'structures_{cc.lower()}')
        op.drop_table(f'geology_{cc.lower()}')