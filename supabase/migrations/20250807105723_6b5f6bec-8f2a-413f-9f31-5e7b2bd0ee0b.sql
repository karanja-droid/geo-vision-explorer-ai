-- Step 1: Drop all policies that depend on the role column
DROP POLICY IF EXISTS "Users can update their own profile (except role)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.profiles;

-- Step 2: Create new enum and update the column
DO $$
BEGIN
    -- Create new enum with all roles
    CREATE TYPE user_role_new AS ENUM (
      'administrator',
      'geologist', 
      'geophysicist',
      'drilling_manager',
      'qa_qc_specialist',
      'environmental_officer',
      'executive'
    );
    
    -- Update profiles table to use new enum
    ALTER TABLE public.profiles 
    ALTER COLUMN role DROP DEFAULT,
    ALTER COLUMN role TYPE user_role_new USING 
      CASE 
        WHEN role::text = 'admin' THEN 'administrator'::user_role_new
        WHEN role::text = 'geologist' THEN 'geologist'::user_role_new
        ELSE 'geologist'::user_role_new
      END,
    ALTER COLUMN role SET DEFAULT 'geologist'::user_role_new;
    
    -- Drop old type and rename new one
    DROP TYPE user_role;
    ALTER TYPE user_role_new RENAME TO user_role;
END $$;

-- Step 3: Recreate the dropped policies with new enum values
CREATE POLICY "Users can update their own profile (except role)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK ((auth.uid() = user_id) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.user_id = auth.uid()))));

CREATE POLICY "Admins can update user roles" 
ON public.profiles 
FOR UPDATE 
USING (get_current_user_role() = 'administrator'::user_role)
WITH CHECK (get_current_user_role() = 'administrator'::user_role);

-- Step 4: Create role permissions matrix table
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
CREATE POLICY "Everyone can view role permissions" 
ON public.role_permissions 
FOR SELECT 
USING (true);

CREATE POLICY "Only administrators can modify role permissions" 
ON public.role_permissions 
FOR ALL 
USING (get_current_user_role() = 'administrator'::user_role)
WITH CHECK (get_current_user_role() = 'administrator'::user_role);

-- Step 5: Insert comprehensive role permission matrix
INSERT INTO public.role_permissions (role, permission_category, permission_action, resource_type, can_create, can_read, can_update, can_delete, conditions) VALUES

-- Administrator permissions (full access)
('administrator', 'system', 'manage', 'all', true, true, true, true, '{}'),
('administrator', 'users', 'manage', 'profiles', true, true, true, true, '{}'),
('administrator', 'projects', 'manage', 'all', true, true, true, true, '{}'),
('administrator', 'data', 'manage', 'all', true, true, true, true, '{}'),

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