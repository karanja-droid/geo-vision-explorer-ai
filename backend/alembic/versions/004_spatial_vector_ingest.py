"""Spatial vector data ingest module

Revision ID: 004_spatial_vector_ingest
Revises: 003_drilling_geochemistry_modules
Create Date: 2025-01-13 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '004_spatial_vector_ingest'
down_revision = '003_drilling_geochemistry_modules'
branch_labels = None
depends_on = None

def upgrade():
    # Vector datasets table
    op.create_table('vector_datasets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('provenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('data_provenance.id')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('dataset_type', sa.String(50), nullable=False),  # geology, structures, boundaries, etc.
        sa.Column('geometry_type', sa.String(20), nullable=False),  # POINT, LINESTRING, POLYGON, etc.
        sa.Column('crs', sa.String(50), nullable=False),
        sa.Column('feature_count', sa.Integer, default=0),
        sa.Column('file_format', sa.String(20)),  # shapefile, geojson, gpkg, etc.
        sa.Column('file_size_bytes', sa.BigInteger),
        sa.Column('s3_key_original', sa.String(500)),
        sa.Column('s3_key_processed', sa.String(500)),
        sa.Column('processing_status', sa.String(20), default='pending'),  # pending, processing, completed, failed
        sa.Column('processing_log', sa.Text),
        sa.Column('bbox', postgresql.ARRAY(sa.Float)),  # [minx, miny, maxx, maxy]
        sa.Column('attributes_schema', postgresql.JSONB),  # Schema of feature attributes
        sa.Column('validation_results', postgresql.JSONB),  # Geometry validation results
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for dataset extent
    op.execute("SELECT AddGeometryColumn('vector_datasets', 'extent_geom', 4326, 'POLYGON', 2);")
    op.execute("CREATE INDEX idx_vector_datasets_extent_geom ON vector_datasets USING GIST (extent_geom);")
    
    # Vector features table (stores actual feature data)
    op.create_table('vector_features',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vector_datasets.id'), nullable=False),
        sa.Column('feature_id', sa.String(100)),  # Original feature ID from source
        sa.Column('attributes', postgresql.JSONB, nullable=False),  # Feature attributes
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for features
    op.execute("SELECT AddGeometryColumn('vector_features', 'geom', 4326, 'GEOMETRY', 2);")
    op.execute("CREATE INDEX idx_vector_features_geom ON vector_features USING GIST (geom);")
    op.execute("CREATE INDEX idx_vector_features_dataset_id ON vector_features (dataset_id);")
    
    # Vector layers table (for organizing datasets into layers)
    op.create_table('vector_layers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('layer_type', sa.String(50), nullable=False),  # geology, structures, boundaries
        sa.Column('style_config', postgresql.JSONB),  # Styling configuration for maps
        sa.Column('visible', sa.Boolean, default=True),
        sa.Column('opacity', sa.Float, default=1.0),
        sa.Column('z_index', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    # Layer datasets relationship (many-to-many)
    op.create_table('layer_datasets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('layer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vector_layers.id'), nullable=False),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vector_datasets.id'), nullable=False),
        sa.Column('order_index', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('layer_id', 'dataset_id', name='unique_layer_dataset')
    )
    
    # Vector tiles cache table (for serving MVT tiles)
    op.create_table('vector_tiles_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('dataset_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('vector_datasets.id'), nullable=False),
        sa.Column('z', sa.Integer, nullable=False),  # Zoom level
        sa.Column('x', sa.Integer, nullable=False),  # Tile X
        sa.Column('y', sa.Integer, nullable=False),  # Tile Y
        sa.Column('tile_data', sa.LargeBinary),  # MVT tile data
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.DateTime(timezone=True)),
        sa.UniqueConstraint('dataset_id', 'z', 'x', 'y', name='unique_tile_zxy')
    )
    
    # Create indexes for tile serving
    op.create_index('idx_vector_tiles_zxy', 'vector_tiles_cache', ['z', 'x', 'y'])
    op.create_index('idx_vector_tiles_expires', 'vector_tiles_cache', ['expires_at'])
    
    # Enable RLS on all new tables
    tables = ['vector_datasets', 'vector_features', 'vector_layers', 'layer_datasets', 'vector_tiles_cache']
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    
    # RLS policies
    op.execute("""
        CREATE POLICY vector_datasets_isolation ON vector_datasets
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY vector_features_isolation ON vector_features
        FOR ALL USING (dataset_id IN (
            SELECT id FROM vector_datasets WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY vector_layers_isolation ON vector_layers
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY layer_datasets_isolation ON layer_datasets
        FOR ALL USING (layer_id IN (
            SELECT id FROM vector_layers WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY vector_tiles_cache_isolation ON vector_tiles_cache
        FOR ALL USING (dataset_id IN (
            SELECT id FROM vector_datasets WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
    """)
    
    # Create spatial functions for tile generation
    op.execute("""
        CREATE OR REPLACE FUNCTION generate_mvt_tile(
            dataset_uuid uuid,
            z integer,
            x integer,
            y integer
        ) RETURNS bytea AS $$
        DECLARE
            tile_bbox geometry;
            mvt_data bytea;
        BEGIN
            -- Calculate tile bounding box
            SELECT ST_TileEnvelope(z, x, y) INTO tile_bbox;
            
            -- Generate MVT tile
            SELECT ST_AsMVT(tile_features, 'features')
            INTO mvt_data
            FROM (
                SELECT 
                    ST_AsMVTGeom(
                        ST_Transform(geom, 3857),
                        ST_TileEnvelope(z, x, y, margin => 64),
                        4096,
                        64,
                        true
                    ) AS geom,
                    attributes
                FROM vector_features vf
                JOIN vector_datasets vd ON vf.dataset_id = vd.id
                WHERE vd.id = dataset_uuid
                AND ST_Intersects(
                    ST_Transform(geom, 3857),
                    ST_TileEnvelope(z, x, y, margin => 64)
                )
            ) AS tile_features
            WHERE geom IS NOT NULL;
            
            RETURN mvt_data;
        END;
        $$ LANGUAGE plpgsql;
    """)

def downgrade():
    # Drop spatial function
    op.execute("DROP FUNCTION IF EXISTS generate_mvt_tile(uuid, integer, integer, integer);")
    
    # Drop tables in reverse order
    op.drop_table('vector_tiles_cache')
    op.drop_table('layer_datasets')
    op.drop_table('vector_layers')
    op.drop_table('vector_features')
    op.drop_table('vector_datasets')