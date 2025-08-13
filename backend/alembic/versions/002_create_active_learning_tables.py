"""Create active learning tables

Revision ID: 002_active_learning
Revises: 001_feature_store
Create Date: 2024-01-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '002_active_learning'
down_revision = '001_feature_store'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create training_labels table
    op.create_table(
        'training_labels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('geom', Geometry('POINT', srid=4326), nullable=False),
        sa.Column('label_value', sa.Float, nullable=False),
        sa.Column('confidence', sa.Float, default=1.0),
        sa.Column('source', sa.String, default='user'),
        sa.Column('weight', sa.Float, default=1.0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inference_id', sa.String, nullable=True),
        sa.Column('uncertainty_value', sa.Float, nullable=True),
        sa.Column('prediction_value', sa.Float, nullable=True),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
        sa.Column('data_classification', sa.String, server_default='internal'),
    )
    
    # Create model_versions table
    op.create_table(
        'model_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('version', sa.String, nullable=False, unique=True),
        sa.Column('base_version', sa.String, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('training_samples', sa.Integer, default=0),
        sa.Column('status', sa.String, default='training'),
        sa.Column('model_path', sa.String, nullable=True),
        sa.Column('training_config', sa.JSON, nullable=True),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
    )
    
    # Create model_metrics table
    op.create_table(
        'model_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('model_version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('model_versions.id', ondelete='CASCADE')),
        sa.Column('metric_name', sa.String, nullable=False),
        sa.Column('metric_value', sa.Float, nullable=False),
        sa.Column('metric_type', sa.String, default='validation'),  # validation, test, cross_validation
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # Create high_uncertainty_zones table for active learning suggestions
    op.create_table(
        'high_uncertainty_zones',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('inference_id', sa.String, nullable=False),
        sa.Column('geom', Geometry('POINT', srid=4326), nullable=False),
        sa.Column('uncertainty_value', sa.Float, nullable=False),
        sa.Column('prediction_value', sa.Float, nullable=False),
        sa.Column('priority_score', sa.Float, nullable=False),
        sa.Column('is_labeled', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Multi-tenancy columns
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id')),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id')),
    )
    
    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_training_labels_geom ON training_labels USING GIST (geom)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_training_labels_org_id ON training_labels (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_training_labels_project_id ON training_labels (project_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_training_labels_source ON training_labels (source)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_training_labels_created_at ON training_labels (created_at)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_versions_version ON model_versions (version)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_versions_org_id ON model_versions (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_versions_status ON model_versions (status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_versions_created_at ON model_versions (created_at)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_metrics_version_id ON model_metrics (model_version_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_model_metrics_name ON model_metrics (metric_name)")
    
    op.execute("CREATE INDEX IF NOT EXISTS idx_high_uncertainty_zones_geom ON high_uncertainty_zones USING GIST (geom)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_high_uncertainty_zones_inference_id ON high_uncertainty_zones (inference_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_high_uncertainty_zones_priority ON high_uncertainty_zones (priority_score DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_high_uncertainty_zones_labeled ON high_uncertainty_zones (is_labeled)")
    
    # Enable RLS on tables
    op.execute("ALTER TABLE training_labels ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE model_metrics ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE high_uncertainty_zones ENABLE ROW LEVEL SECURITY")
    
    # Create RLS policies
    op.execute("""
        CREATE POLICY training_labels_org_access ON training_labels
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
        CREATE POLICY model_versions_org_access ON model_versions
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
        CREATE POLICY model_metrics_access ON model_metrics
        FOR ALL USING (
            model_version_id IN (
                SELECT id FROM model_versions 
                WHERE org_id = COALESCE(
                    current_setting('app.current_org_id', true)::UUID,
                    (SELECT org_id FROM project_members pm 
                     JOIN projects p ON pm.project_id = p.id 
                     WHERE pm.user_id = auth.uid() LIMIT 1)
                )
            )
        )
    """)
    
    op.execute("""
        CREATE POLICY high_uncertainty_zones_org_access ON high_uncertainty_zones
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
    op.execute("DROP POLICY IF EXISTS high_uncertainty_zones_org_access ON high_uncertainty_zones")
    op.execute("DROP POLICY IF EXISTS model_metrics_access ON model_metrics")
    op.execute("DROP POLICY IF EXISTS model_versions_org_access ON model_versions")
    op.execute("DROP POLICY IF EXISTS training_labels_org_access ON training_labels")
    
    # Drop tables
    op.drop_table('high_uncertainty_zones')
    op.drop_table('model_metrics')
    op.drop_table('model_versions')
    op.drop_table('training_labels')