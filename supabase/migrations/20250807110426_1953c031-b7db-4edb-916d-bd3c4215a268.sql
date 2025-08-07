-- Create role permissions matrix table first with existing roles
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL, -- Using TEXT temporarily to avoid enum issues
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
CREATE POLICY "Everyone can view role permissions" 
ON public.role_permissions 
FOR SELECT 
USING (true);

CREATE POLICY "Only administrators can modify role permissions" 
ON public.role_permissions 
FOR ALL 
USING (get_current_user_role()::text IN ('administrator', 'admin'))
WITH CHECK (get_current_user_role()::text IN ('administrator', 'admin'));

-- Insert permissions for existing roles first
INSERT INTO public.role_permissions (role, permission_category, permission_action, resource_type, can_create, can_read, can_update, can_delete, conditions) VALUES

-- Admin permissions (full access)
('admin', 'system', 'manage', 'all', true, true, true, true, '{}'),
('admin', 'users', 'manage', 'profiles', true, true, true, true, '{}'),
('admin', 'projects', 'manage', 'all', true, true, true, true, '{}'),
('admin', 'data', 'manage', 'all', true, true, true, true, '{}'),

-- Geologist permissions
('geologist', 'projects', 'manage', 'geological_data', true, true, true, false, '{"scope": "assigned_projects"}'),
('geologist', 'sites', 'manage', 'exploration_sites', true, true, true, false, '{"scope": "assigned_projects"}'),
('geologist', 'data', 'view', 'mineral_deposits', false, true, false, false, '{"scope": "assigned_projects"}'),
('geologist', 'ai', 'run', 'predictions', true, true, false, false, '{"scope": "assigned_projects"}'),
('geologist', 'reports', 'generate', 'geological', true, true, false, false, '{"scope": "assigned_projects"}')

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
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (user_id = auth.uid());

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
CREATE POLICY "Users can manage their own MFA settings" 
ON public.user_mfa_settings 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create function to check user permissions using TEXT for now
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_permission_category TEXT,
  p_permission_action TEXT,
  p_resource_type TEXT,
  p_action_type TEXT DEFAULT 'read'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role_val TEXT;
  permission_exists BOOLEAN := false;
BEGIN
  -- Get current user role as text
  SELECT get_current_user_role()::text INTO user_role_val;
  
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