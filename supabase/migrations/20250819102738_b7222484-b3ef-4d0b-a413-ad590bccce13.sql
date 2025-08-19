-- Phase 1: Core Infrastructure Alignment
-- Add multi-tenant organization support and config-based feature flags

-- Create organizations table for multi-tenancy
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  region TEXT NOT NULL DEFAULT 'ZA',
  country_code TEXT NOT NULL DEFAULT 'ZA',
  subscription_tier TEXT NOT NULL DEFAULT 'individual',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create organizations policies
CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  id IN (
    SELECT org_id FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage organizations" 
ON public.organizations 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Update profiles table to include organization
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Update projects table with multi-tenant fields
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'ZA',
ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted'));

-- Update exploration_sites with org context
ALTER TABLE public.exploration_sites 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Update feature_flags for config-based management
ALTER TABLE public.feature_flags 
DROP COLUMN IF EXISTS module,
ADD COLUMN IF NOT EXISTS module TEXT,
ADD COLUMN IF NOT EXISTS tier_restrictions TEXT[],
ADD COLUMN IF NOT EXISTS user_restrictions UUID[];

-- Create module registry table for dynamic modules
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  enabled BOOLEAN NOT NULL DEFAULT true,
  routes TEXT[],
  exports TEXT[],
  reports TEXT[],
  permissions JSONB DEFAULT '{}',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Create modules policies
CREATE POLICY "Everyone can view enabled modules" 
ON public.modules 
FOR SELECT 
USING (enabled = true);

CREATE POLICY "Admins can manage modules" 
ON public.modules 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Insert core modules from configuration
INSERT INTO public.modules (key, name, description, routes, exports, reports) VALUES
('maps', 'Maps Module', 'Interactive mapping and geospatial visualization', ARRAY['maps'], ARRAY['png'], ARRAY[]::TEXT[]),
('data', 'Data Management', 'Geological and geospatial data management', ARRAY['data'], ARRAY['gpkg', 'geojson', 'cog', 'mvt'], ARRAY[]::TEXT[]),
('ai', 'AI & Prospectivity', 'AI-powered mineral prospectivity analysis', ARRAY['ai'], ARRAY['cog_prospectivity', 'cog_uncertainty', 'csv_targets', 'png_map'], ARRAY['target_pack_pdf']),
('drill', 'Drilling Management', 'Drill program planning and tracking', ARRAY['drill'], ARRAY['csv', 'xlsx', 'gpkg_collars', 'gltf_paths', 'pdf_drill_summary'], ARRAY['progress_pdf']),
('lims', 'Laboratory Information Management', 'Sample tracking and QA/QC', ARRAY['lims'], ARRAY['csv_clean', 'xlsx_clean', 'json_qc_flags', 'pdf_qaqc'], ARRAY['qaqc_pdf']),
('esg', 'Environmental & Social Governance', 'ESG compliance and reporting', ARRAY['esg'], ARRAY['gpkg', 'geojson', 'csv_permits', 'pdf_eia_appendix'], ARRAY['esg_summary_pdf']),
('survey', 'Surveying', 'Land surveying and control points', ARRAY['survey'], ARRAY['gpkg', 'cog_dtm', 'csv_control_points', 'pdf_collar_cert'], ARRAY['survey_adjustment_pdf']),
('planner', 'Mine Planning', 'Resource planning and scenario modeling', ARRAY['planner'], ARRAY['csv_scenarios', 'parquet', 'png_plots', 'pdf_scenarios'], ARRAY['npv_irr_pdf']),
('viewer3d', '3D Visualization', 'Three-dimensional geological visualization', ARRAY['3d'], ARRAY['gltf', 'glb', 'vtk'], ARRAY[]::TEXT[]),
('reports', 'Reporting', 'Executive and technical reporting', ARRAY['reports'], ARRAY['pdf'], ARRAY['exec_kpi_pdf', 'investor_update_pdf']),
('admin', 'Administration', 'System administration and management', ARRAY['admin'], ARRAY['csv_usage', 'pdf_invoice'], ARRAY['audit_status_pdf'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  routes = EXCLUDED.routes,
  exports = EXCLUDED.exports,
  reports = EXCLUDED.reports,
  updated_at = now();

-- Update feature flags with configuration-based flags
INSERT INTO public.feature_flags (name, description, enabled, module, metadata) VALUES
('FEATURE_MAPS', 'Interactive mapping capabilities', true, 'maps', '{"priority": "high"}'),
('FEATURE_DATA', 'Data management and ingestion', true, 'data', '{"priority": "high"}'),
('FEATURE_AI', 'AI and machine learning features', true, 'ai', '{"priority": "high"}'),
('FEATURE_DRILL', 'Drilling data management', true, 'drill', '{"priority": "medium"}'),
('FEATURE_LIMS', 'Laboratory information management', true, 'lims', '{"priority": "medium"}'),
('FEATURE_ESG', 'Environmental and governance', true, 'esg', '{"priority": "medium"}'),
('FEATURE_3D', '3D visualization capabilities', true, 'viewer3d', '{"priority": "low"}'),
('FEATURE_REPORTS', 'Advanced reporting system', true, 'reports', '{"priority": "high"}'),
('FEATURE_ADMIN', 'Administration interface', true, 'admin', '{"priority": "high"}'),
('FEATURE_UNCERTAINTY', 'Uncertainty quantification', true, 'ai', '{"priority": "medium"}'),
('FEATURE_FEATURE_STORE', 'Feature store for ML', true, 'ai', '{"priority": "medium"}'),
('FEATURE_ACTIVE_LEARNING', 'Active learning workflows', true, 'ai', '{"priority": "low"}'),
('FEATURE_TILES_CATALOG', 'STAC tile catalog', true, 'data', '{"priority": "medium"}'),
('FEATURE_TRIALS', 'Trial and subscription management', true, 'admin', '{"priority": "high"}'),
('FEATURE_METERING', 'Usage metering and billing', true, 'admin', '{"priority": "high"}'),
('FEATURE_SSO', 'Single sign-on integration', false, 'admin', '{"priority": "low"}'),
('FEATURE_SCIM', 'System for Cross-domain Identity Management', false, 'admin', '{"priority": "low"}'),
('FEATURE_WORM_AUDIT', 'Write-once read-many audit logs', true, 'admin', '{"priority": "medium"}'),
('FEATURE_RELIABILITY', 'System reliability features', true, 'admin', '{"priority": "high"}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  module = EXCLUDED.module,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Create function to get current user organization
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update RLS policies to include organization context
DROP POLICY IF EXISTS "Users can view projects they own or participate in" ON public.projects;
CREATE POLICY "Users can view projects in their organization" 
ON public.projects 
FOR SELECT 
USING (
  org_id = get_current_user_org_id() OR 
  owner_id = auth.uid() OR 
  get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects in their organization" 
ON public.projects 
FOR INSERT 
WITH CHECK (
  org_id = get_current_user_org_id() AND 
  owner_id = auth.uid()
);

-- Update exploration_sites RLS for multi-tenancy
DROP POLICY IF EXISTS "Users can view sites from accessible projects" ON public.exploration_sites;
CREATE POLICY "Users can view sites in their organization" 
ON public.exploration_sites 
FOR SELECT 
USING (
  org_id = get_current_user_org_id() OR 
  get_current_user_role() = 'admin'
);

-- Create routing configuration table
CREATE TABLE IF NOT EXISTS public.routing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_pattern TEXT NOT NULL DEFAULT '/:org/:project',
  paths TEXT[] NOT NULL DEFAULT '{}',
  org_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on routing_config
ALTER TABLE public.routing_config ENABLE ROW LEVEL SECURITY;

-- Create policies for routing config
CREATE POLICY "Organization members can view routing config" 
ON public.routing_config 
FOR SELECT 
USING (
  org_id = get_current_user_org_id() OR 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Admins can manage routing config" 
ON public.routing_config 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Insert default routing configuration
INSERT INTO public.routing_config (base_pattern, paths) VALUES
('/:org/:project', ARRAY['maps', 'data', 'ai', 'drill', 'lims', 'esg', '3d', 'reports', 'admin']);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_region ON public.organizations(region);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_region ON public.projects(region);
CREATE INDEX IF NOT EXISTS idx_exploration_sites_org_id ON public.exploration_sites(org_id);
CREATE INDEX IF NOT EXISTS idx_modules_key ON public.modules(key);
CREATE INDEX IF NOT EXISTS idx_modules_enabled ON public.modules(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_module ON public.feature_flags(module);

-- Create function to handle organization creation on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_with_org()
RETURNS TRIGGER AS $$
DECLARE
  default_org_id UUID;
  user_display_name TEXT;
BEGIN
  -- Extract display name from metadata
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );

  -- Create default organization for new user
  INSERT INTO public.organizations (name, slug, region, country_code, subscription_tier)
  VALUES (
    user_display_name || '''s Organization',
    'org-' || LOWER(REPLACE(user_display_name, ' ', '-')) || '-' || SUBSTRING(NEW.id::text FROM 1 FOR 8),
    'ZA',
    'ZA',
    'individual'
  )
  RETURNING id INTO default_org_id;

  -- Create user profile with organization
  INSERT INTO public.profiles (id, user_id, display_name, role, org_id)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    user_display_name,
    'geologist',
    default_org_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_with_org();