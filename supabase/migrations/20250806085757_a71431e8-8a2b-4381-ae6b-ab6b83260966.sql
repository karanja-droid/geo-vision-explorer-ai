-- Create new types if they don't exist
DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('individual', 'starter_team', 'corporate', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE feature_module AS ENUM ('exploration', 'visualization_2d', 'visualization_3d', 'reporting', 'collaboration', 'drill_management', 'lab_workflow', 'resource_estimation', 'geotech_hydro', 'environment_social', 'safety', 'logistics', 'finance_portfolio', 'mobile_capture', 'anomaly_detection');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enhanced projects table with more geological fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geology_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_minerals TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS coordinates GEOMETRY(POLYGON, 4326);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province TEXT;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Project members for role-based access
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'viewer',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Feature flags for module management
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  module feature_module,
  enabled BOOLEAN NOT NULL DEFAULT true,
  tier_restrictions subscription_tier[] DEFAULT NULL,
  user_restrictions UUID[] DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions and billing
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier subscription_tier NOT NULL DEFAULT 'individual',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_start_date TIMESTAMPTZ DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage metrics for billing
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- 'ai_runs', 'map_tiles', 'gee_hours', 'bigquery_gb'
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_members
CREATE POLICY "Users can view project members for accessible projects" ON project_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_members.project_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm WHERE pm.project_id = p.id
    ))
  )
);

CREATE POLICY "Project owners can manage members" ON project_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_members.project_id 
    AND p.owner_id = auth.uid()
  )
);

-- RLS Policies for feature_flags
CREATE POLICY "Everyone can view feature flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Admins can manage feature flags" ON feature_flags FOR ALL USING (
  get_current_user_role() = 'admin'
);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);

-- RLS Policies for usage_metrics
CREATE POLICY "Users can view own usage metrics" ON usage_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert usage metrics" ON usage_metrics FOR INSERT WITH CHECK (true);

-- Insert default feature flags
INSERT INTO feature_flags (name, description, module, enabled, tier_restrictions) VALUES
('exploration_core', 'Core exploration functionality', 'exploration', true, NULL),
('2d_visualization', '2D mapping and visualization', 'visualization_2d', true, NULL),
('3d_visualization', '3D geological modeling', 'visualization_3d', true, ARRAY['corporate', 'enterprise']::subscription_tier[]),
('advanced_reporting', 'PDF reports and exports', 'reporting', true, ARRAY['starter_team', 'corporate', 'enterprise']::subscription_tier[]),
('real_time_collaboration', 'Live collaboration features', 'collaboration', true, ARRAY['starter_team', 'corporate', 'enterprise']::subscription_tier[]),
('drill_management', 'Drilling planning and tracking', 'drill_management', true, ARRAY['corporate', 'enterprise']::subscription_tier[]),
('lab_workflow', 'Sample tracking and LIMS', 'lab_workflow', true, ARRAY['corporate', 'enterprise']::subscription_tier[]),
('resource_estimation', 'Resource modeling tools', 'resource_estimation', true, ARRAY['enterprise']::subscription_tier[]),
('ai_prospectivity', 'AI-driven prospectivity analysis', 'anomaly_detection', true, ARRAY['starter_team', 'corporate', 'enterprise']::subscription_tier[])
ON CONFLICT (name) DO NOTHING;