-- Feature Flags Management System
-- Allows dynamic feature toggling and A/B testing

-- Feature flags table
CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    flag_category VARCHAR(50) NOT NULL, -- 'phase_a', 'phase_b', 'phase_c', 'experimental'
    is_enabled BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true, -- Can be used to soft-delete flags
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_audience JSONB, -- User segments, organizations, roles
    dependencies TEXT[], -- Other flags this depends on
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature flag history for audit trail
CREATE TABLE feature_flag_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
    previous_state JSONB NOT NULL,
    new_state JSONB NOT NULL,
    change_reason TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feature flag overrides (for testing/beta users)
CREATE TABLE user_feature_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL,
    override_reason TEXT,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, flag_id)
);

-- A/B test configurations
CREATE TABLE ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(200) NOT NULL,
    description TEXT,
    flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
    control_percentage INTEGER DEFAULT 50 CHECK (control_percentage >= 0 AND control_percentage <= 100),
    treatment_percentage INTEGER DEFAULT 50 CHECK (treatment_percentage >= 0 AND treatment_percentage <= 100),
    target_audience JSONB, -- Criteria for test participation
    success_metrics TEXT[], -- What metrics to track
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'running', 'paused', 'completed', 'cancelled'
    results JSONB, -- Test results and analysis
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_percentages CHECK (control_percentage + treatment_percentage = 100)
);

-- A/B test participant assignments
CREATE TABLE ab_test_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    variant VARCHAR(20) NOT NULL, -- 'control', 'treatment'
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- Feature usage analytics
CREATE TABLE feature_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID REFERENCES feature_flags(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    usage_date DATE DEFAULT CURRENT_DATE,
    usage_count INTEGER DEFAULT 1,
    session_duration_seconds INTEGER,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(flag_id, user_id, usage_date)
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_test_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Feature flags are readable by all authenticated users
CREATE POLICY "feature_flags_read_all" ON feature_flags
    FOR SELECT TO authenticated USING (true);

-- Only admins can modify feature flags
CREATE POLICY "feature_flags_admin_modify" ON feature_flags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organization_memberships uom
            WHERE uom.user_id = auth.uid()
            AND uom.role = 'admin'
            AND uom.is_active = true
        )
    );

-- Users can view their own overrides
CREATE POLICY "user_overrides_own" ON user_feature_overrides
    FOR SELECT USING (user_id = auth.uid());

-- Admins can manage all overrides
CREATE POLICY "user_overrides_admin" ON user_feature_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_organization_memberships uom
            WHERE uom.user_id = auth.uid()
            AND uom.role = 'admin'
            AND uom.is_active = true
        )
    );

-- Feature usage analytics - users can view their own, admins can view all
CREATE POLICY "usage_analytics_policy" ON feature_usage_analytics
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM user_organization_memberships uom
            WHERE uom.user_id = auth.uid()
            AND uom.role IN ('admin', 'manager')
            AND uom.is_active = true
        )
    );

-- Indexes for performance
CREATE INDEX idx_feature_flags_category ON feature_flags(flag_category, is_active);
CREATE INDEX idx_feature_flags_enabled ON feature_flags(is_enabled, is_active);
CREATE INDEX idx_flag_history_flag_date ON feature_flag_history(flag_id, changed_at DESC);
CREATE INDEX idx_user_overrides_user ON user_feature_overrides(user_id, expires_at);
CREATE INDEX idx_ab_tests_status ON ab_tests(status, start_date, end_date);
CREATE INDEX idx_usage_analytics_flag_date ON feature_usage_analytics(flag_id, usage_date DESC);

-- Function to check if a feature is enabled for a user
CREATE OR REPLACE FUNCTION is_feature_enabled(
    p_flag_name VARCHAR(100),
    p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE
    flag_record RECORD;
    user_override BOOLEAN;
    ab_test_variant VARCHAR(20);
BEGIN
    -- Get the feature flag
    SELECT * INTO flag_record
    FROM feature_flags
    WHERE flag_name = p_flag_name
    AND is_active = true;
    
    -- If flag doesn't exist or is inactive, return false
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Check for user-specific override
    SELECT is_enabled INTO user_override
    FROM user_feature_overrides
    WHERE flag_id = flag_record.id
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());
    
    -- If user override exists, use it
    IF FOUND THEN
        RETURN user_override;
    END IF;
    
    -- Check if user is in an A/B test
    SELECT variant INTO ab_test_variant
    FROM ab_test_participants atp
    JOIN ab_tests ab ON ab.id = atp.test_id
    WHERE ab.flag_id = flag_record.id
    AND atp.user_id = p_user_id
    AND ab.status = 'running'
    AND NOW() BETWEEN ab.start_date AND ab.end_date;
    
    -- If in A/B test, return based on variant
    IF FOUND THEN
        RETURN ab_test_variant = 'treatment';
    END IF;
    
    -- Check rollout percentage
    IF flag_record.rollout_percentage < 100 THEN
        -- Use user ID hash to determine if user is in rollout
        IF (hashtext(p_user_id::text) % 100) >= flag_record.rollout_percentage THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Return the flag's default state
    RETURN flag_record.is_enabled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log feature usage
CREATE OR REPLACE FUNCTION log_feature_usage(
    p_flag_name VARCHAR(100),
    p_session_duration INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    flag_id UUID;
    user_org_id UUID;
BEGIN
    -- Get flag ID
    SELECT id INTO flag_id
    FROM feature_flags
    WHERE flag_name = p_flag_name;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Get user's organization
    SELECT organization_id INTO user_org_id
    FROM user_organization_memberships
    WHERE user_id = auth.uid()
    AND is_active = true
    LIMIT 1;
    
    -- Insert or update usage record
    INSERT INTO feature_usage_analytics (
        flag_id,
        user_id,
        organization_id,
        session_duration_seconds,
        user_agent,
        ip_address
    ) VALUES (
        flag_id,
        auth.uid(),
        user_org_id,
        p_session_duration,
        current_setting('request.headers', true)::json->>'user-agent',
        inet_client_addr()
    )
    ON CONFLICT (flag_id, user_id, usage_date)
    DO UPDATE SET
        usage_count = feature_usage_analytics.usage_count + 1,
        session_duration_seconds = COALESCE(EXCLUDED.session_duration_seconds, feature_usage_analytics.session_duration_seconds);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create feature flag history entry
CREATE OR REPLACE FUNCTION create_flag_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO feature_flag_history (
        flag_id,
        previous_state,
        new_state,
        changed_by
    ) VALUES (
        NEW.id,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END,
        to_jsonb(NEW),
        auth.uid()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for feature flag history
CREATE TRIGGER feature_flag_history_trigger
    AFTER INSERT OR UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION create_flag_history();

-- Insert default feature flags based on the Python configuration
INSERT INTO feature_flags (flag_name, display_name, description, flag_category, is_enabled) VALUES
-- Phase A Features (Currently Implemented)
('FEATURE_AI_ANALYSIS', 'AI Analysis Dashboard', 'Advanced AI-powered geological analysis and mineral detection', 'phase_a', true),
('FEATURE_IOT_MONITORING', 'IoT Monitoring', 'Real-time sensor monitoring and anomaly detection', 'phase_a', true),
('FEATURE_3D_MODELING', '3D Geological Modeling', 'Interactive 3D geological model visualization and generation', 'phase_a', true),
('FEATURE_BUSINESS_INTELLIGENCE', 'Business Intelligence', 'Comprehensive analytics, KPIs, and reporting dashboard', 'phase_a', true),
('FEATURE_LLM_CONSULTATION', 'LLM Geological Consultation', 'AI-powered geological expert consultation system', 'phase_a', true),
('FEATURE_ENHANCED_SECURITY', 'Enhanced Security', 'ABAC security with immutable audit trails', 'phase_a', true),
('FEATURE_UNCERTAINTY_MAPS', 'Uncertainty Quantification', 'Uncertainty maps and confidence intervals for AI predictions', 'phase_a', true),
('FEATURE_ACTIVE_LEARNING', 'Active Learning', 'Expert feedback loops for AI model improvement', 'phase_a', true),

-- Phase B Features (Matching Python config)
('FEATURE_DRILL_MANAGEMENT', 'Drill Management', 'Comprehensive drilling operations and core sample management', 'phase_b', true),
('FEATURE_LAB_WORKFLOW', 'Laboratory Workflow', 'Laboratory information management and QA/QC workflows', 'phase_b', true),
('FEATURE_RESOURCE_MODELING', 'Resource Modeling', 'Advanced resource estimation and reserve calculations', 'phase_b', false),
('FEATURE_LIMS_INTEGRATION', 'LIMS Integration', 'Laboratory Information Management System integration', 'phase_b', true),
('FEATURE_3D_TILES_LOD', '3D Tiles LOD Rendering', 'Level-of-detail 3D tile rendering for large datasets', 'phase_b', false),
('FEATURE_DRIFT_MONITORING', 'Model Drift Monitoring', 'AI model performance monitoring and drift detection', 'phase_b', false),

-- Phase C Features (Matching Python config)
('FEATURE_GEOSPATIAL_AR', 'Geospatial AR Tools', 'Augmented reality tools for field geological surveys', 'phase_c', false),
('FEATURE_MOBILE_OFFLINE', 'Mobile Offline Sync', 'Offline mobile data collection with background sync', 'phase_c', false),
('FEATURE_CREDITS_WALLET', 'Credits Wallet', 'Usage-based billing with credits wallet system', 'phase_c', false),
('FEATURE_DATA_RESIDENCY', 'Data Residency', 'Country-specific data residency and compliance', 'phase_c', false),
('FEATURE_CMK_ENCRYPTION', 'Customer Managed Keys', 'Customer-managed encryption keys for enhanced security', 'phase_c', false),

-- Advanced Features
('FEATURE_STAC_COG_PIPELINE', 'STAC/COG Pipeline', 'Cloud-optimized geospatial data processing pipeline', 'advanced', true),
('FEATURE_VECTOR_TILES', 'Vector Tiles', 'High-performance vector tile rendering for geological data', 'advanced', true),
('FEATURE_CONFORMAL_PREDICTION', 'Conformal Prediction', 'Statistical prediction intervals with coverage guarantees', 'advanced', true),
('FEATURE_SAVED_VIEWS', 'Saved Views', 'Save and share map views with deep linking', 'advanced', false),
('FEATURE_DEEP_LINKS', 'Deep Links', 'Shareable URLs that restore exact application state', 'advanced', false)

ON CONFLICT (flag_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    flag_category = EXCLUDED.flag_category,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();