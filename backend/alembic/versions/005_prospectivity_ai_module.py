"""Prospectivity and AI analysis module

Revision ID: 005_prospectivity_ai_module
Revises: 004_spatial_vector_ingest
Create Date: 2025-01-13 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers
revision = '005_prospectivity_ai_module'
down_revision = '004_spatial_vector_ingest'
branch_labels = None
depends_on = None

def upgrade():
    # AI models table
    op.create_table('ai_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('model_type', sa.String(50), nullable=False),  # prospectivity, classification, regression
        sa.Column('target_commodity', sa.String(50)),  # Au, Cu, etc.
        sa.Column('model_version', sa.String(20), nullable=False),
        sa.Column('algorithm', sa.String(50)),  # random_forest, neural_network, svm, etc.
        sa.Column('training_data_count', sa.Integer, default=0),
        sa.Column('validation_accuracy', sa.Float),
        sa.Column('feature_importance', postgresql.JSONB),  # Feature importance scores
        sa.Column('hyperparameters', postgresql.JSONB),  # Model hyperparameters
        sa.Column('s3_key_model', sa.String(500)),  # S3 key for model file
        sa.Column('s3_key_scaler', sa.String(500)),  # S3 key for feature scaler
        sa.Column('status', sa.String(20), default='training'),  # training, ready, deprecated
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    # Prospectivity runs table
    op.create_table('prospectivity_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('country_code', sa.String(2), nullable=False),
        sa.Column('data_classification', sa.Enum('public', 'internal', 'confidential', name='data_classification'), default='internal'),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id'), nullable=False),
        sa.Column('run_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('input_datasets', postgresql.JSONB, nullable=False),  # List of input dataset IDs
        sa.Column('parameters', postgresql.JSONB),  # Run parameters
        sa.Column('status', sa.String(20), default='pending'),  # pending, running, completed, failed
        sa.Column('progress_percent', sa.Float, default=0.0),
        sa.Column('started_at', sa.DateTime(timezone=True)),
        sa.Column('completed_at', sa.DateTime(timezone=True)),
        sa.Column('error_message', sa.Text),
        sa.Column('s3_key_prospectivity', sa.String(500)),  # Prospectivity raster
        sa.Column('s3_key_uncertainty', sa.String(500)),  # Uncertainty raster
        sa.Column('s3_key_targets', sa.String(500)),  # Target points
        sa.Column('bbox', postgresql.ARRAY(sa.Float)),
        sa.Column('statistics', postgresql.JSONB),  # Run statistics
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for run extent
    op.execute("SELECT AddGeometryColumn('prospectivity_runs', 'extent_geom', 4326, 'POLYGON', 2);")
    op.execute("CREATE INDEX idx_prospectivity_runs_extent_geom ON prospectivity_runs USING GIST (extent_geom);")
    
    # Prospectivity targets table
    op.create_table('prospectivity_targets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('prospectivity_runs.id'), nullable=False),
        sa.Column('target_id', sa.String(50), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('prospectivity_score', sa.Float, nullable=False),
        sa.Column('uncertainty_score', sa.Float),
        sa.Column('confidence_level', sa.String(20)),  # high, medium, low
        sa.Column('target_type', sa.String(50)),  # primary, secondary, exploration
        sa.Column('ranking', sa.Integer),
        sa.Column('attributes', postgresql.JSONB),  # Additional target attributes
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for target location
    op.execute("SELECT AddGeometryColumn('prospectivity_targets', 'geom', 4326, 'POINT', 2);")
    op.execute("CREATE INDEX idx_prospectivity_targets_geom ON prospectivity_targets USING GIST (geom);")
    
    # Training data table
    op.create_table('training_data',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id'), nullable=False),
        sa.Column('sample_id', sa.String(100), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('label', sa.Float, nullable=False),  # 0 = negative, 1 = positive, or continuous value
        sa.Column('weight', sa.Float, default=1.0),  # Sample weight for training
        sa.Column('data_source', sa.String(100)),  # drilling, geochemistry, geology, etc.
        sa.Column('source_id', postgresql.UUID(as_uuid=True)),  # ID of source record
        sa.Column('features', postgresql.JSONB),  # Feature vector for training
        sa.Column('validation_set', sa.Boolean, default=False),  # True if part of validation set
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for training sample location
    op.execute("SELECT AddGeometryColumn('training_data', 'geom', 4326, 'POINT', 2);")
    op.execute("CREATE INDEX idx_training_data_geom ON training_data USING GIST (geom);")
    
    # Model performance metrics table
    op.create_table('model_performance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id'), nullable=False),
        sa.Column('metric_name', sa.String(50), nullable=False),  # accuracy, precision, recall, f1, auc, etc.
        sa.Column('metric_value', sa.Float, nullable=False),
        sa.Column('validation_type', sa.String(20), nullable=False),  # train, validation, test, cross_validation
        sa.Column('fold_number', sa.Integer),  # For cross-validation
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Feature importance table
    op.create_table('feature_importance',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_models.id'), nullable=False),
        sa.Column('feature_name', sa.String(100), nullable=False),
        sa.Column('importance_score', sa.Float, nullable=False),
        sa.Column('importance_rank', sa.Integer),
        sa.Column('feature_type', sa.String(50)),  # geological, geochemical, geophysical, topographic
        sa.Column('data_source', sa.String(100)),  # Source dataset or layer
        sa.Column('calculated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Model predictions cache table
    op.create_table('model_predictions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('run_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('prospectivity_runs.id'), nullable=False),
        sa.Column('easting', sa.Float, nullable=False),
        sa.Column('northing', sa.Float, nullable=False),
        sa.Column('prediction_value', sa.Float, nullable=False),
        sa.Column('uncertainty_value', sa.Float),
        sa.Column('feature_vector', postgresql.JSONB),  # Input features used for prediction
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'))
    )
    
    # Add PostGIS geometry column for prediction location
    op.execute("SELECT AddGeometryColumn('model_predictions', 'geom', 4326, 'POINT', 2);")
    op.execute("CREATE INDEX idx_model_predictions_geom ON model_predictions USING GIST (geom);")
    
    # Enable RLS on all new tables
    tables = [
        'ai_models', 'prospectivity_runs', 'prospectivity_targets', 
        'training_data', 'model_performance', 'feature_importance', 'model_predictions'
    ]
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    
    # RLS policies
    op.execute("""
        CREATE POLICY ai_models_isolation ON ai_models
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY prospectivity_runs_isolation ON prospectivity_runs
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY prospectivity_targets_isolation ON prospectivity_targets
        FOR ALL USING (run_id IN (
            SELECT id FROM prospectivity_runs WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY training_data_isolation ON training_data
        FOR ALL USING (org_id = current_setting('app.current_org_id')::uuid);
        
        CREATE POLICY model_performance_isolation ON model_performance
        FOR ALL USING (model_id IN (
            SELECT id FROM ai_models WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY feature_importance_isolation ON feature_importance
        FOR ALL USING (model_id IN (
            SELECT id FROM ai_models WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
        
        CREATE POLICY model_predictions_isolation ON model_predictions
        FOR ALL USING (run_id IN (
            SELECT id FROM prospectivity_runs WHERE org_id = current_setting('app.current_org_id')::uuid
        ));
    """)
    
    # Create indexes for performance
    op.create_index('idx_prospectivity_runs_model_id', 'prospectivity_runs', ['model_id'])
    op.create_index('idx_prospectivity_runs_status', 'prospectivity_runs', ['status'])
    op.create_index('idx_prospectivity_targets_run_id', 'prospectivity_targets', ['run_id'])
    op.create_index('idx_prospectivity_targets_score', 'prospectivity_targets', ['prospectivity_score'])
    op.create_index('idx_training_data_model_id', 'training_data', ['model_id'])
    op.create_index('idx_training_data_label', 'training_data', ['label'])
    op.create_index('idx_model_performance_model_id', 'model_performance', ['model_id'])
    op.create_index('idx_feature_importance_model_id', 'feature_importance', ['model_id'])
    op.create_index('idx_model_predictions_run_id', 'model_predictions', ['run_id'])

def downgrade():
    # Drop tables in reverse order
    op.drop_table('model_predictions')
    op.drop_table('feature_importance')
    op.drop_table('model_performance')
    op.drop_table('training_data')
    op.drop_table('prospectivity_targets')
    op.drop_table('prospectivity_runs')
    op.drop_table('ai_models')