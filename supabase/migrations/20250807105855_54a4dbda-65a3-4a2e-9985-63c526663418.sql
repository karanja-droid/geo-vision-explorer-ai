-- Add new role values to existing enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'geophysicist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'drilling_manager'; 
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'qa_qc_specialist';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'environmental_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'executive';

-- Update any existing 'admin' roles to 'administrator'
UPDATE public.profiles SET role = 'administrator' WHERE role = 'admin';

-- Create role permissions matrix table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  permission_category TEXT NOT NULL,
  permission_action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  can_create BOOLEAN DEFAULT false,
  can_read BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, permission_category, permission_action, resource_type)
);

-- Enable RLS on role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create policies for role_permissions table
DROP POLICY IF EXISTS "Everyone can view role permissions" ON public.role_permissions;
CREATE POLICY "Everyone can view role permissions" 
ON public.role_permissions 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Only administrators can modify role permissions" ON public.role_permissions;
CREATE POLICY "Only administrators can modify role permissions" 
ON public.role_permissions 
FOR ALL 
USING (get_current_user_role() IN ('administrator'::user_role, 'admin'::user_role))
WITH CHECK (get_current_user_role() IN ('administrator'::user_role, 'admin'::user_role));

-- Insert comprehensive role permission matrix
INSERT INTO public.role_permissions (role, permission_category, permission_action, resource_type, can_create, can_read, can_update, can_delete, conditions) VALUES

-- Administrator permissions (full access)
('administrator', 'system', 'manage', 'all', true, true, true, true, '{}'),
('administrator', 'users', 'manage', 'profiles', true, true, true, true, '{}'),
('administrator', 'projects', 'manage', 'all', true, true, true, true, '{}'),
('administrator', 'data', 'manage', 'all', true, true, true, true, '{}'),

-- Admin (legacy) permissions (full access)
('admin', 'system', 'manage', 'all', true, true, true, true, '{}'),
('admin', 'users', 'manage', 'profiles', true, true, true, true, '{}'),
('admin', 'projects', 'manage', 'all', true, true, true, true, '{}'),
('admin', 'data', 'manage', 'all', true, true, true, true, '{}'),

-- Geologist permissions
('geologist', 'projects', 'manage', 'geological_data', true, true, true, false, '{"scope": "assigned_projects"}'),
('geologist', 'sites', 'manage', 'exploration_sites', true, true, true, false, '{"scope": "assigned_projects"}'),
('geologist', 'data', 'view', 'mineral_deposits', false, true, false, false, '{"scope": "assigned_projects"}'),
('geologist', 'ai', 'run', 'predictions', true, true, false, false, '{"scope": "assigned_projects"}'),
('geologist', 'reports', 'generate', 'geological', true, true, false, false, '{"scope": "assigned_projects"}'),

-- Geophysicist permissions  
('geophysicist', 'projects', 'view', 'geophysical_data', false, true, false, false, '{"scope": "assigned_projects"}'),
('geophysicist', 'sites', 'manage', 'geophysical_surveys', true, true, true, false, '{"scope": "assigned_projects"}'),
('geophysicist', 'data', 'upload', 'geophysical', true, true, true, false, '{"scope": "assigned_projects"}'),
('geophysicist', 'ai', 'run', 'geophysical_models', true, true, false, false, '{"scope": "assigned_projects"}'),
('geophysicist', 'reports', 'generate', 'geophysical', true, true, false, false, '{"scope": "assigned_projects"}'),

-- Drilling Manager permissions
('drilling_manager', 'drilling', 'manage', 'programs', true, true, true, false, '{"scope": "assigned_projects"}'),
('drilling_manager', 'data', 'upload', 'drill_logs', true, true, true, false, '{"scope": "assigned_projects"}'),
('drilling_manager', 'sites', 'view', 'drilling_sites', false, true, false, false, '{"scope": "assigned_projects"}'),
('drilling_manager', 'reports', 'generate', 'drilling', true, true, false, false, '{"scope": "assigned_projects"}'),
('drilling_manager', 'safety', 'manage', 'protocols', false, true, true, false, '{"scope": "assigned_projects"}'),

-- QA/QC Specialist permissions
('qa_qc_specialist', 'data', 'validate', 'all', false, true, true, false, '{"scope": "assigned_projects"}'),
('qa_qc_specialist', 'qa_qc', 'manage', 'protocols', true, true, true, false, '{"scope": "assigned_projects"}'),
('qa_qc_specialist', 'reports', 'generate', 'qa_qc', true, true, false, false, '{"scope": "assigned_projects"}'),
('qa_qc_specialist', 'data', 'flag', 'anomalies', true, true, true, false, '{"scope": "assigned_projects"}'),

-- Environmental Officer permissions
('environmental_officer', 'environmental', 'manage', 'assessments', true, true, true, false, '{"scope": "assigned_projects"}'),
('environmental_officer', 'compliance', 'monitor', 'regulations', false, true, true, false, '{"scope": "assigned_projects"}'),
('environmental_officer', 'reports', 'generate', 'environmental', true, true, false, false, '{"scope": "assigned_projects"}'),
('environmental_officer', 'permits', 'manage', 'environmental', false, true, true, false, '{"scope": "assigned_projects"}'),

-- Executive permissions
('executive', 'reports', 'view', 'executive_dashboard', false, true, false, false, '{"scope": "all_projects"}'),
('executive', 'analytics', 'view', 'kpis', false, true, false, false, '{"scope": "all_projects"}'),
('executive', 'projects', 'view', 'overview', false, true, false, false, '{"scope": "all_projects"}'),
('executive', 'financials', 'view', 'budgets', false, true, false, false, '{"scope": "all_projects"}')

ON CONFLICT (role, permission_category, permission_action, resource_type) DO NOTHING;

-- Create user sessions table for enhanced security tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  mfa_verified BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can manage sessions" ON public.user_sessions;
CREATE POLICY "System can manage sessions" 
ON public.user_sessions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create MFA settings table
CREATE TABLE IF NOT EXISTS public.user_mfa_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  mfa_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[],
  totp_secret TEXT,
  recovery_email TEXT,
  last_backup_code_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_mfa_settings
ALTER TABLE public.user_mfa_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for MFA settings
DROP POLICY IF EXISTS "Users can manage their own MFA settings" ON public.user_mfa_settings;
CREATE POLICY "Users can manage their own MFA settings" 
ON public.user_mfa_settings 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_permission_category TEXT,
  p_permission_action TEXT,
  p_resource_type TEXT,
  p_action_type TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_val user_role;
  permission_exists BOOLEAN := false;
BEGIN
  -- Get current user role
  SELECT get_current_user_role() INTO user_role_val;
  
  -- Check if permission exists
  SELECT 
    CASE 
      WHEN p_action_type = 'create' THEN can_create
      WHEN p_action_type = 'read' THEN can_read
      WHEN p_action_type = 'update' THEN can_update
      WHEN p_action_type = 'delete' THEN can_delete
      ELSE false
    END
  INTO permission_exists
  FROM public.role_permissions 
  WHERE role = user_role_val 
    AND permission_category = p_permission_category 
    AND permission_action = p_permission_action 
    AND resource_type = p_resource_type;
    
  RETURN COALESCE(permission_exists, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;