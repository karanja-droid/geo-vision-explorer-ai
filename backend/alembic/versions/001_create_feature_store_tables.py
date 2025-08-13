"""Create feature store tables

Revision ID: 001_feature_store
Revises: 
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '001_feature_store'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create organizations table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            data_region TEXT DEFAULT 'us-west-2',
            kms_key_alias TEXT,
            trial_ends_at TIMESTAMP WITH TIME ZONE
        )
    """)
    
    # Create projects table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            data_classification TEXT DEFAULT 'internal'
        )
    """)
    
    # Create project_members table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS project_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            user_id UUID NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    
    # Create fs_cells table
    op.create_table(
        'fs_cells',
        sa.Column('cell_id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('geom', Geometry('POINT', srid=4326), nullable=False),
        sa.Column('country', sa.String, nullable=False),
        sa.Column('province', sa.String),
        sa.Column('scale', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        sa.Column('data_classification', sa.String, server_default='internal'),
    )
    
    # Create fs_features table
    op.create_table(
        'fs_features',
        sa.Column('cell_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fs_cells.cell_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('feature_key', sa.String, primary_key=True),
        sa.Column('feature_val', sa.Float, nullable=False),
    )
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_cells_geom ON fs_cells USING GIST (geom)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_cells_country ON fs_cells (country)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_cells_scale ON fs_cells (scale)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_cells_org_id ON fs_cells (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_cells_project_id ON fs_cells (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_fs_features_key ON fs_features (feature_key)")
    
    # Enable RLS on tables
    op.execute("ALTER TABLE fs_cells ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE fs_features ENABLE ROW LEVEL SECURITY")
    
    # Create RLS policies for fs_cells
    op.execute("""
        CREATE POLICY fs_cells_org_access ON fs_cells
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
        CREATE POLICY fs_cells_classification_access ON fs_cells
        FOR SELECT USING (
            CASE data_classification
                WHEN 'public' THEN true
                WHEN 'internal' THEN COALESCE(current_setting('app.user_role', true), 'viewer') != 'external'
                WHEN 'confidential' THEN COALESCE(current_setting('app.user_role', true), 'viewer') IN ('admin', 'analyst')
                ELSE false
            END
        )
    """)
    
    # Create RLS policies for fs_features
    op.execute("""
        CREATE POLICY fs_features_access ON fs_features
        FOR ALL USING (
            cell_id IN (
                SELECT cell_id FROM fs_cells 
                WHERE org_id = COALESCE(
                    current_setting('app.current_org_id', true)::UUID,
                    (SELECT org_id FROM project_members pm 
                     JOIN projects p ON pm.project_id = p.id 
                     WHERE pm.user_id = auth.uid() LIMIT 1)
                )
            )
        )
    """)


def downgrade() -> None:
    # Drop RLS policies
    op.execute("DROP POLICY IF EXISTS fs_features_access ON fs_features")
    op.execute("DROP POLICY IF EXISTS fs_cells_classification_access ON fs_cells")
    op.execute("DROP POLICY IF EXISTS fs_cells_org_access ON fs_cells")
    
    # Drop tables
    op.drop_table('fs_features')
    op.drop_table('fs_cells')
    
    # Note: We don't drop organizations, projects, project_members as they might be used by other parts