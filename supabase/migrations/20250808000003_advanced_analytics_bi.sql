-- Advanced Analytics and Business Intelligence
-- Market Data Integration
CREATE TABLE commodity_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commodity VARCHAR(50) NOT NULL, -- 'gold', 'copper', 'iron_ore', 'lithium'
    price DECIMAL(15,6),
    currency VARCHAR(3) DEFAULT 'USD',
    exchange VARCHAR(50), -- 'LME', 'COMEX', 'SHFE'
    price_date DATE,
    price_type VARCHAR(20) DEFAULT 'spot', -- 'spot', 'future_1m', 'future_3m'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Economic Analysis
CREATE TABLE economic_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    model_name VARCHAR(200),
    commodity VARCHAR(50),
    resource_estimate DECIMAL(15,2), -- tonnes
    grade_estimate DECIMAL(10,6), -- percentage or g/t
    recovery_rate DECIMAL(5,2), -- percentage
    operating_cost_per_tonne DECIMAL(10,2),
    capital_expenditure DECIMAL(15,2),
    discount_rate DECIMAL(5,2),
    mine_life_years INTEGER,
    npv DECIMAL(15,2), -- Net Present Value
    irr DECIMAL(5,2), -- Internal Rate of Return
    payback_period_years DECIMAL(5,2),
    sensitivity_analysis JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk Assessment
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    risk_category VARCHAR(50) NOT NULL, -- 'geological', 'environmental', 'political', 'economic', 'technical'
    risk_description TEXT,
    probability VARCHAR(20), -- 'very_low', 'low', 'medium', 'high', 'very_high'
    impact VARCHAR(20), -- 'negligible', 'minor', 'moderate', 'major', 'catastrophic'
    risk_score DECIMAL(5,2), -- Calculated risk score
    mitigation_strategies TEXT[],
    contingency_plans TEXT,
    responsible_party UUID REFERENCES auth.users(id),
    review_date DATE,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'mitigated', 'accepted', 'transferred'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ESG (Environmental, Social, Governance) Metrics
CREATE TABLE esg_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    metric_category VARCHAR(20) NOT NULL, -- 'environmental', 'social', 'governance'
    metric_name VARCHAR(100),
    metric_value DECIMAL(15,6),
    unit VARCHAR(50),
    measurement_date DATE,
    target_value DECIMAL(15,6),
    benchmark_value DECIMAL(15,6),
    compliance_status VARCHAR(20), -- 'compliant', 'warning', 'non_compliant'
    reporting_standard VARCHAR(50), -- 'GRI', 'SASB', 'TCFD', 'UN_SDG'
    verification_status VARCHAR(20), -- 'unverified', 'self_reported', 'third_party_verified'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulatory Compliance Tracking
CREATE TABLE regulatory_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction VARCHAR(100), -- Country/state/province
    requirement_type VARCHAR(50), -- 'permit', 'license', 'environmental_assessment', 'safety_standard'
    requirement_name VARCHAR(200),
    description TEXT,
    regulatory_body VARCHAR(100),
    compliance_deadline DATE,
    renewal_period_months INTEGER,
    penalty_for_non_compliance TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE project_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES regulatory_requirements(id) ON DELETE CASCADE,
    compliance_status VARCHAR(20) NOT NULL, -- 'compliant', 'pending', 'non_compliant', 'not_applicable'
    compliance_date DATE,
    expiry_date DATE,
    documentation_url TEXT,
    notes TEXT,
    responsible_officer UUID REFERENCES auth.users(id),
    last_reviewed DATE,
    next_review_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholder Management
CREATE TABLE stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    stakeholder_type VARCHAR(50), -- 'community', 'government', 'investor', 'supplier', 'ngo', 'indigenous_group'
    organization_name VARCHAR(200),
    contact_person VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    influence_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    interest_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    relationship_status VARCHAR(20), -- 'supportive', 'neutral', 'opposed', 'unknown'
    engagement_strategy TEXT,
    last_contact_date DATE,
    next_contact_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholder Engagement Log
CREATE TABLE stakeholder_engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
    engagement_type VARCHAR(50), -- 'meeting', 'consultation', 'presentation', 'survey', 'complaint'
    engagement_date DATE,
    participants TEXT[],
    topics_discussed TEXT[],
    outcomes TEXT,
    follow_up_actions TEXT[],
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    conducted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance KPIs and Dashboards
CREATE TABLE kpi_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_name VARCHAR(100) UNIQUE,
    kpi_category VARCHAR(50), -- 'operational', 'financial', 'environmental', 'safety', 'social'
    description TEXT,
    calculation_method TEXT,
    unit VARCHAR(50),
    target_value DECIMAL(15,6),
    frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'quarterly', 'annually'
    data_source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kpi_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpi_definitions(id) ON DELETE CASCADE,
    measurement_date DATE,
    actual_value DECIMAL(15,6),
    target_value DECIMAL(15,6),
    variance_percentage DECIMAL(8,4),
    trend VARCHAR(20), -- 'improving', 'stable', 'declining'
    comments TEXT,
    measured_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Tracking and Budget Management
CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    cost_center_code VARCHAR(50),
    cost_center_name VARCHAR(200),
    description TEXT,
    budget_allocated DECIMAL(15,2),
    budget_spent DECIMAL(15,2),
    budget_committed DECIMAL(15,2),
    budget_remaining DECIMAL(15,2) GENERATED ALWAYS AS (budget_allocated - budget_spent - budget_committed) STORED,
    responsible_manager UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cost_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_center_id UUID REFERENCES cost_centers(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL, -- 'expense', 'commitment', 'adjustment'
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    transaction_date DATE,
    description TEXT,
    vendor VARCHAR(200),
    invoice_number VARCHAR(100),
    approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE commodity_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE regulatory_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Commodity prices are publicly readable" ON commodity_prices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage economic models for their projects" ON economic_models
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = economic_models.project_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage risk assessments for their projects" ON risk_assessments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = risk_assessments.project_id
            AND p.created_by = auth.uid()
        )
    );

-- Indexes for analytics queries
CREATE INDEX idx_commodity_prices_commodity_date ON commodity_prices(commodity, price_date DESC);
CREATE INDEX idx_economic_models_project ON economic_models(project_id);
CREATE INDEX idx_risk_assessments_project_category ON risk_assessments(project_id, risk_category);
CREATE INDEX idx_esg_metrics_project_category ON esg_metrics(project_id, metric_category, measurement_date DESC);
CREATE INDEX idx_kpi_measurements_project_date ON kpi_measurements(project_id, measurement_date DESC);
CREATE INDEX idx_cost_transactions_center_date ON cost_transactions(cost_center_id, transaction_date DESC);