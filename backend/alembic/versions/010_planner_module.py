"""Planner module tables

Revision ID: 010_planner_module
Revises: 009_surveyor_module
Create Date: 2025-01-14 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '010_planner_module'
down_revision = '009_surveyor_module'
branch_labels = None
depends_on = None

def upgrade():
    # Resource Models table
    op.create_table('resource_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('model_version', sa.String(20), nullable=False),
        sa.Column('commodity', sa.String(50), nullable=False),
        sa.Column('model_type', sa.String(50), nullable=False),  # block_model, wireframe, geological
        sa.Column('estimation_method', sa.String(50), nullable=False),  # OK, IDW, NN, kriging
        sa.Column('block_size_x', sa.Float, nullable=True),  # metres
        sa.Column('block_size_y', sa.Float, nullable=True),  # metres
        sa.Column('block_size_z', sa.Float, nullable=True),  # metres
        sa.Column('model_extent', sa.Text, nullable=False),  # GeoJSON Polygon
        sa.Column('total_blocks', sa.Integer, nullable=True),
        sa.Column('total_tonnage', sa.Float, nullable=True),  # tonnes
        sa.Column('average_grade', sa.Float, nullable=True),
        sa.Column('grade_unit', sa.String(10), nullable=True),
        sa.Column('cut_off_grade', sa.Float, nullable=True),
        sa.Column('confidence_category', sa.String(20), nullable=True),  # measured, indicated, inferred
        sa.Column('estimation_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('estimated_by', sa.String(100), nullable=False),
        sa.Column('validation_results', postgresql.JSONB, nullable=True),
        sa.Column('model_files', postgresql.JSONB, nullable=True),  # Array of file paths
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_resource_models_org_project', 'org_id', 'project_id'),
        sa.Index('idx_resource_models_commodity', 'commodity'),
        sa.Index('idx_resource_models_version', 'model_version'),
        sa.UniqueConstraint('org_id', 'project_id', 'model_name', 'model_version', name='uq_resource_models_org_project_name_version')
    )

    # Mining Scenarios table
    op.create_table('mining_scenarios',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('country_code', sa.String(3), nullable=False),
        sa.Column('data_classification', sa.String(20), nullable=False, server_default='internal'),
        sa.Column('scenario_name', sa.String(100), nullable=False),
        sa.Column('scenario_description', sa.Text, nullable=True),
        sa.Column('resource_model_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('resource_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mining_method', sa.String(50), nullable=False),  # open_pit, underground, combined
        sa.Column('production_rate', sa.Float, nullable=False),  # tonnes/day or tonnes/year
        sa.Column('mine_life', sa.Float, nullable=True),  # years
        sa.Column('cut_off_grade', sa.Float, nullable=False),
        sa.Column('recovery_rate', sa.Float, nullable=False),  # percentage
        sa.Column('dilution_factor', sa.Float, nullable=True),  # percentage
        sa.Column('strip_ratio', sa.Float, nullable=True),  # waste:ore
        sa.Column('commodity_price', sa.Float, nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='USD'),
        sa.Column('operating_cost', sa.Float, nullable=True),  # per tonne
        sa.Column('capital_cost', sa.Float, nullable=True),  # total
        sa.Column('discount_rate', sa.Float, nullable=False, server_default='8.0'),  # percentage
        sa.Column('tax_rate', sa.Float, nullable=True),  # percentage
        sa.Column('royalty_rate', sa.Float, nullable=True),  # percentage
        sa.Column('npv', sa.Float, nullable=True),  # Net Present Value
        sa.Column('irr', sa.Float, nullable=True),  # Internal Rate of Return
        sa.Column('payback_period', sa.Float, nullable=True),  # years
        sa.Column('created_by', sa.String(100), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_mining_scenarios_org_project', 'org_id', 'project_id'),
        sa.Index('idx_mining_scenarios_resource_model', 'resource_model_id'),
        sa.Index('idx_mining_scenarios_method', 'mining_method')
    )

    # Production Schedules table
    op.create_table('production_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scenario_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('mining_scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('schedule_name', sa.String(100), nullable=False),
        sa.Column('schedule_type', sa.String(20), nullable=False),  # annual, monthly, quarterly
        sa.Column('period_number', sa.Integer, nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ore_tonnes', sa.Float, nullable=False),
        sa.Column('waste_tonnes', sa.Float, nullable=False),
        sa.Column('total_tonnes', sa.Float, nullable=False),
        sa.Column('average_grade', sa.Float, nullable=False),
        sa.Column('metal_production', sa.Float, nullable=False),
        sa.Column('strip_ratio', sa.Float, nullable=True),
        sa.Column('operating_cost', sa.Float, nullable=True),
        sa.Column('capital_cost', sa.Float, nullable=True),
        sa.Column('revenue', sa.Float, nullable=True),
        sa.Column('cash_flow', sa.Float, nullable=True),
        sa.Column('cumulative_cash_flow', sa.Float, nullable=True),
        sa.Column('mining_areas', postgresql.JSONB, nullable=True),  # Array of mining block IDs
        sa.Column('equipment_requirements', postgresql.JSONB, nullable=True),
        sa.Column('workforce_requirements', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_production_schedules_scenario', 'scenario_id'),
        sa.Index('idx_production_schedules_period', 'period_number'),
        sa.UniqueConstraint('scenario_id', 'period_number', name='uq_production_schedules_scenario_period')
    )

    # Economic Models table
    op.create_table('economic_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scenario_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('mining_scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('model_type', sa.String(50), nullable=False),  # dcf, real_options, monte_carlo
        sa.Column('base_case_npv', sa.Float, nullable=False),
        sa.Column('base_case_irr', sa.Float, nullable=False),
        sa.Column('sensitivity_analysis', postgresql.JSONB, nullable=True),  # Sensitivity results
        sa.Column('risk_analysis', postgresql.JSONB, nullable=True),  # Risk assessment results
        sa.Column('assumptions', postgresql.JSONB, nullable=False),  # Model assumptions
        sa.Column('cash_flow_profile', postgresql.JSONB, nullable=True),  # Annual cash flows
        sa.Column('capex_schedule', postgresql.JSONB, nullable=True),  # Capital expenditure schedule
        sa.Column('opex_breakdown', postgresql.JSONB, nullable=True),  # Operating cost breakdown
        sa.Column('commodity_prices', postgresql.JSONB, nullable=True),  # Price assumptions
        sa.Column('exchange_rates', postgresql.JSONB, nullable=True),  # Currency assumptions
        sa.Column('tax_calculations', postgresql.JSONB, nullable=True),  # Tax computations
        sa.Column('model_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modeled_by', sa.String(100), nullable=False),
        sa.Column('reviewed_by', sa.String(100), nullable=True),
        sa.Column('review_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_economic_models_scenario', 'scenario_id'),
        sa.Index('idx_economic_models_type', 'model_type'),
        sa.Index('idx_economic_models_status', 'status')
    )

    # Risk Assessments table
    op.create_table('risk_assessments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scenario_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('mining_scenarios.id', ondelete='CASCADE'), nullable=True),
        sa.Column('assessment_name', sa.String(100), nullable=False),
        sa.Column('assessment_type', sa.String(50), nullable=False),  # technical, financial, environmental, social
        sa.Column('risk_category', sa.String(50), nullable=False),
        sa.Column('risk_description', sa.Text, nullable=False),
        sa.Column('probability', sa.String(20), nullable=False),  # very_low, low, medium, high, very_high
        sa.Column('impact', sa.String(20), nullable=False),  # very_low, low, medium, high, very_high
        sa.Column('risk_score', sa.Float, nullable=False),  # Calculated risk score
        sa.Column('mitigation_measures', sa.Text, nullable=True),
        sa.Column('residual_probability', sa.String(20), nullable=True),
        sa.Column('residual_impact', sa.String(20), nullable=True),
        sa.Column('residual_risk_score', sa.Float, nullable=True),
        sa.Column('responsible_party', sa.String(100), nullable=True),
        sa.Column('target_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='identified'),
        sa.Column('assessed_by', sa.String(100), nullable=False),
        sa.Column('assessment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('review_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source', sa.String(100), nullable=True),
        sa.Column('license', sa.String(100), nullable=True),
        sa.Column('collected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index('idx_risk_assessments_org_project', 'org_id', 'project_id'),
        sa.Index('idx_risk_assessments_scenario', 'scenario_id'),
        sa.Index('idx_risk_assessments_category', 'risk_category'),
        sa.Index('idx_risk_assessments_score', 'risk_score')
    )

    # Enable RLS on all tables
    tables = [
        'resource_models', 'mining_scenarios', 'production_schedules',
        'economic_models', 'risk_assessments'
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
        'risk_assessments', 'economic_models', 'production_schedules',
        'mining_scenarios', 'resource_models'
    ]
    
    for table in tables:
        op.drop_table(table)