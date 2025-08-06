-- Create enhanced project management tables
CREATE TYPE project_status AS ENUM ('planning', 'active', 'completed', 'on_hold', 'cancelled');
CREATE TYPE user_role AS ENUM ('admin', 'geologist', 'geophysicist', 'driller', 'qa_qc', 'environmental', 'executive', 'viewer');
CREATE TYPE subscription_tier AS ENUM ('individual', 'starter_team', 'corporate', 'enterprise');
CREATE TYPE feature_module AS ENUM ('exploration', 'visualization_2d', 'visualization_3d', 'reporting', 'collaboration', 'drill_management', 'lab_workflow', 'resource_estimation', 'geotech_hydro', 'environment_social', 'safety', 'logistics', 'finance_portfolio', 'mobile_capture', 'anomaly_detection');

-- Enhanced projects table with more geological fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geology_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_minerals TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS coordinates GEOMETRY(POLYGON, 4326);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS province TEXT;

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
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
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

-- Geological surveys and data
CREATE TABLE IF NOT EXISTS geological_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
  survey_type TEXT NOT NULL, -- 'magnetic', 'gravity', 'EM', 'seismic', 'geochemical'
  survey_date DATE,
  data_file_url TEXT,
  processing_status TEXT DEFAULT 'pending',
  results JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI processing jobs
CREATE TABLE IF NOT EXISTS ai_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- 'prospectivity', 'anomaly_detection', 'resource_estimation'
  input_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  progress NUMERIC DEFAULT 0,
  results JSONB DEFAULT '{}',
  error_message TEXT,
  processing_time_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drill holes management
CREATE TABLE IF NOT EXISTS drill_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
  hole_id TEXT NOT NULL,
  planned_depth NUMERIC,
  actual_depth NUMERIC,
  collar_location GEOMETRY(POINT, 4326),
  azimuth NUMERIC,
  dip NUMERIC,
  drilling_start_date DATE,
  drilling_end_date DATE,
  status TEXT DEFAULT 'planned',
  core_recovery_percent NUMERIC,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sample management
CREATE TABLE IF NOT EXISTS samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_hole_id UUID REFERENCES drill_holes(id) ON DELETE CASCADE,
  sample_id TEXT NOT NULL UNIQUE,
  from_depth NUMERIC NOT NULL,
  to_depth NUMERIC NOT NULL,
  sample_type TEXT, -- 'core', 'cuttings', 'grab', 'channel'
  lab_batch TEXT,
  assay_results JSONB DEFAULT '{}',
  qaqc_status TEXT DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE geological_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies for feature_flags (admin only management, public read)
CREATE POLICY "Everyone can view feature flags" ON feature_flags FOR SELECT USING (true);
CREATE POLICY "Admins can manage feature flags" ON feature_flags FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK (true);

-- RLS Policies for usage_metrics
CREATE POLICY "Users can view own usage metrics" ON usage_metrics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert usage metrics" ON usage_metrics FOR INSERT WITH CHECK (true);

-- RLS Policies for geological_surveys
CREATE POLICY "Users can view surveys from accessible projects" ON geological_surveys
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = geological_surveys.project_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm WHERE pm.project_id = p.id
    ))
  )
);

CREATE POLICY "Users can manage surveys in accessible projects" ON geological_surveys
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = geological_surveys.project_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.role IN ('admin', 'geologist', 'geophysicist')
    ))
  )
);

-- RLS Policies for ai_processing_jobs
CREATE POLICY "Users can view own AI jobs" ON ai_processing_jobs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create AI jobs" ON ai_processing_jobs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "System can update AI jobs" ON ai_processing_jobs FOR UPDATE USING (true);

-- RLS Policies for drill_holes
CREATE POLICY "Users can view drill holes from accessible sites" ON drill_holes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM exploration_sites es
    JOIN projects p ON es.project_id = p.id
    WHERE es.id = drill_holes.site_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm WHERE pm.project_id = p.id
    ))
  )
);

CREATE POLICY "Users can manage drill holes in accessible sites" ON drill_holes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM exploration_sites es
    JOIN projects p ON es.project_id = p.id
    WHERE es.id = drill_holes.site_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.role IN ('admin', 'geologist', 'driller')
    ))
  )
);

-- RLS Policies for samples
CREATE POLICY "Users can view samples from accessible drill holes" ON samples
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM drill_holes dh
    JOIN exploration_sites es ON dh.site_id = es.id
    JOIN projects p ON es.project_id = p.id
    WHERE dh.id = samples.drill_hole_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm WHERE pm.project_id = p.id
    ))
  )
);

CREATE POLICY "Users can manage samples from accessible drill holes" ON samples
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM drill_holes dh
    JOIN exploration_sites es ON dh.site_id = es.id
    JOIN projects p ON es.project_id = p.id
    WHERE dh.id = samples.drill_hole_id 
    AND (p.owner_id = auth.uid() OR auth.uid() IN (
      SELECT pm.user_id FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.role IN ('admin', 'geologist', 'qa_qc')
    ))
  )
);

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