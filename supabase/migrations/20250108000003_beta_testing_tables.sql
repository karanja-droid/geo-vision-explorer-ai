-- GeoVision AI Miner - Beta Testing Tables Migration
-- This migration creates all necessary tables for beta testing functionality

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Beta Users Table
CREATE TABLE IF NOT EXISTS beta_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'geologist', 'geophysicist', 'drilling_manager', 
        'qa_specialist', 'environmental_officer', 'executive', 'administrator'
    )),
    company VARCHAR(255) NOT NULL,
    experience_level VARCHAR(20) NOT NULL CHECK (experience_level IN ('junior', 'senior', 'expert')),
    beta_phase VARCHAR(20) NOT NULL CHECK (beta_phase IN ('closed', 'extended', 'open')),
    status VARCHAR(20) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'completed', 'churned')),
    signup_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active TIMESTAMPTZ,
    feedback_score DECIMAL(3,2), -- Average feedback score (1.00 to 5.00)
    feature_usage JSONB DEFAULT '{}', -- Track feature usage counts
    metadata JSONB DEFAULT '{}', -- Additional user metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES beta_users(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    satisfaction_score INTEGER NOT NULL CHECK (satisfaction_score BETWEEN 1 AND 5),
    usage_frequency VARCHAR(20) NOT NULL CHECK (usage_frequency IN ('daily', 'weekly', 'monthly', 'rarely')),
    feedback_text TEXT NOT NULL,
    feedback_type VARCHAR(20) NOT NULL DEFAULT 'general' CHECK (feedback_type IN ('general', 'bug', 'improvement', 'praise')),
    improvement_suggestion TEXT,
    bug_description TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta Metrics Table (for performance and usage tracking)
CREATE TABLE IF NOT EXISTS beta_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES beta_users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('view', 'click', 'form_submit', 'api_call', 'error')),
    response_time_ms INTEGER,
    error_message TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}', -- Store additional context (user_agent, ip, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta Test Sessions Table
CREATE TABLE IF NOT EXISTS beta_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES beta_users(id) ON DELETE CASCADE,
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    duration_minutes INTEGER,
    pages_visited INTEGER DEFAULT 0,
    features_used TEXT[] DEFAULT '{}',
    user_agent TEXT,
    ip_address INET,
    device_type VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beta Invitations Table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    beta_phase VARCHAR(20) NOT NULL CHECK (beta_phase IN ('closed', 'extended', 'open')),
    invited_by UUID REFERENCES profiles(id),
    invitation_code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beta_users_email ON beta_users(email);
CREATE INDEX IF NOT EXISTS idx_beta_users_phase ON beta_users(beta_phase);
CREATE INDEX IF NOT EXISTS idx_beta_users_status ON beta_users(status);
CREATE INDEX IF NOT EXISTS idx_beta_users_signup_date ON beta_users(signup_date);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_feature ON beta_feedback(feature_name);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_timestamp ON beta_feedback(timestamp);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_score ON beta_feedback(satisfaction_score);

CREATE INDEX IF NOT EXISTS idx_beta_metrics_user_id ON beta_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_metrics_feature ON beta_metrics(feature_name);
CREATE INDEX IF NOT EXISTS idx_beta_metrics_action ON beta_metrics(action_type);
CREATE INDEX IF NOT EXISTS idx_beta_metrics_timestamp ON beta_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_beta_metrics_response_time ON beta_metrics(response_time_ms);

CREATE INDEX IF NOT EXISTS idx_beta_sessions_user_id ON beta_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_sessions_start ON beta_sessions(session_start);

CREATE INDEX IF NOT EXISTS idx_beta_invitations_email ON beta_invitations(email);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_code ON beta_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_status ON beta_invitations(status);

-- Create updated_at trigger for beta_users
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_beta_users_updated_at 
    BEFORE UPDATE ON beta_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_invitations ENABLE ROW LEVEL SECURITY;

-- Beta Users Policies
CREATE POLICY "Beta users can view their own data" ON beta_users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all beta users" ON beta_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'administrator'
        )
    );

CREATE POLICY "Beta users can update their own data" ON beta_users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Beta Feedback Policies
CREATE POLICY "Users can view their own feedback" ON beta_feedback
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own feedback" ON beta_feedback
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all feedback" ON beta_feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'administrator'
        )
    );

-- Beta Metrics Policies
CREATE POLICY "Users can view their own metrics" ON beta_metrics
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own metrics" ON beta_metrics
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can view all metrics" ON beta_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'administrator'
        )
    );

-- Beta Sessions Policies
CREATE POLICY "Users can view their own sessions" ON beta_sessions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own sessions" ON beta_sessions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own sessions" ON beta_sessions
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Beta Invitations Policies
CREATE POLICY "Admins can manage invitations" ON beta_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'administrator'
        )
    );

-- Functions for beta testing analytics

-- Function to get user distribution analytics
CREATE OR REPLACE FUNCTION get_beta_user_distribution()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'by_role', (
            SELECT json_object_agg(role, count)
            FROM (
                SELECT role, COUNT(*) as count
                FROM beta_users
                GROUP BY role
            ) role_counts
        ),
        'by_phase', (
            SELECT json_object_agg(beta_phase, count)
            FROM (
                SELECT beta_phase, COUNT(*) as count
                FROM beta_users
                GROUP BY beta_phase
            ) phase_counts
        ),
        'by_experience', (
            SELECT json_object_agg(experience_level, count)
            FROM (
                SELECT experience_level, COUNT(*) as count
                FROM beta_users
                GROUP BY experience_level
            ) exp_counts
        ),
        'by_status', (
            SELECT json_object_agg(status, count)
            FROM (
                SELECT status, COUNT(*) as count
                FROM beta_users
                GROUP BY status
            ) status_counts
        ),
        'total_users', (SELECT COUNT(*) FROM beta_users)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get satisfaction score analytics
CREATE OR REPLACE FUNCTION get_beta_satisfaction_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'average_score', COALESCE(AVG(satisfaction_score), 0),
        'total_responses', COUNT(*),
        'score_distribution', (
            SELECT json_object_agg(satisfaction_score::text, count)
            FROM (
                SELECT satisfaction_score, COUNT(*) as count
                FROM beta_feedback
                GROUP BY satisfaction_score
                ORDER BY satisfaction_score
            ) score_dist
        )
    ) INTO result
    FROM beta_feedback;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get performance metrics analytics
CREATE OR REPLACE FUNCTION get_beta_performance_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'average_response_time', COALESCE(AVG(response_time_ms), 0),
        'p95_response_time', COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms), 0),
        'total_requests', COUNT(*),
        'fast_requests', COUNT(*) FILTER (WHERE response_time_ms < 2000),
        'slow_requests', COUNT(*) FILTER (WHERE response_time_ms >= 2000),
        'error_rate', (
            COUNT(*) FILTER (WHERE action_type = 'error')::float / 
            NULLIF(COUNT(*), 0) * 100
        )
    ) INTO result
    FROM beta_metrics
    WHERE response_time_ms IS NOT NULL;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get feature adoption analytics
CREATE OR REPLACE FUNCTION get_beta_feature_adoption()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_object_agg(feature_name, usage_count)
    INTO result
    FROM (
        SELECT feature_name, COUNT(*) as usage_count
        FROM beta_feedback
        GROUP BY feature_name
        ORDER BY usage_count DESC
    ) feature_usage;
    
    RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive beta analytics
CREATE OR REPLACE FUNCTION get_beta_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_distribution', get_beta_user_distribution(),
        'satisfaction_scores', get_beta_satisfaction_analytics(),
        'performance_metrics', get_beta_performance_analytics(),
        'feature_adoption', get_beta_feature_adoption(),
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_beta_user_distribution() TO authenticated;
GRANT EXECUTE ON FUNCTION get_beta_satisfaction_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_beta_performance_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_beta_feature_adoption() TO authenticated;
GRANT EXECUTE ON FUNCTION get_beta_analytics() TO authenticated;

-- Insert some sample beta testing data for development
INSERT INTO beta_users (email, full_name, role, company, experience_level, beta_phase, status) VALUES
('sarah.chen@barrick.com', 'Dr. Sarah Chen', 'geologist', 'Barrick Gold Corporation', 'expert', 'closed', 'active'),
('michael.rodriguez@newmont.com', 'Michael Rodriguez', 'geologist', 'Newmont Corporation', 'senior', 'closed', 'active'),
('james.wilson@riotinto.com', 'Dr. James Wilson', 'geophysicist', 'Rio Tinto', 'expert', 'closed', 'active'),
('lisa.thompson@bhp.com', 'Lisa Thompson', 'environmental_officer', 'BHP Group', 'senior', 'extended', 'active'),
('david.kim@angloamerican.com', 'David Kim', 'drilling_manager', 'Anglo American', 'senior', 'extended', 'active');

-- Insert sample feedback
INSERT INTO beta_feedback (user_id, feature_name, satisfaction_score, usage_frequency, feedback_text, feedback_type) 
SELECT 
    bu.id,
    'ai_mineral_analysis',
    5,
    'daily',
    'The AI predictions are incredibly accurate and have helped us identify three new high-potential sites.',
    'praise'
FROM beta_users bu WHERE bu.email = 'sarah.chen@barrick.com';

INSERT INTO beta_feedback (user_id, feature_name, satisfaction_score, usage_frequency, feedback_text, feedback_type)
SELECT 
    bu.id,
    'interactive_map',
    4,
    'weekly',
    'The 3D mapping is excellent, but could use better mobile optimization.',
    'improvement'
FROM beta_users bu WHERE bu.email = 'michael.rodriguez@newmont.com';

-- Insert sample metrics
INSERT INTO beta_metrics (user_id, session_id, feature_name, action_type, response_time_ms)
SELECT 
    bu.id,
    uuid_generate_v4(),
    'project_dashboard',
    'view',
    1200
FROM beta_users bu LIMIT 5;

COMMENT ON TABLE beta_users IS 'Beta testing users with role and phase information';
COMMENT ON TABLE beta_feedback IS 'User feedback collected during beta testing';
COMMENT ON TABLE beta_metrics IS 'Performance and usage metrics for beta testing';
COMMENT ON TABLE beta_sessions IS 'User session tracking for beta testing';
COMMENT ON TABLE beta_invitations IS 'Beta testing invitation management';