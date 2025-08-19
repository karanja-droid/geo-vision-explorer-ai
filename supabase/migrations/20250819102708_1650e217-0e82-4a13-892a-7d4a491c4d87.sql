-- Phase 1: Core Infrastructure - Organizations and Multi-tenancy
-- Step 1: Create organizations table first

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

-- Step 2: Add org_id to existing tables
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'ZA',
ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal';

ALTER TABLE public.exploration_sites 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Step 3: Create function to get current user organization (now that org_id exists)
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 4: Create organizations policies (now that function exists)
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

-- Step 5: Update feature flags and create modules
ALTER TABLE public.feature_flags 
ADD COLUMN IF NOT EXISTS module TEXT,
ADD COLUMN IF NOT EXISTS tier_restrictions TEXT[],
ADD COLUMN IF NOT EXISTS user_restrictions UUID[];

-- Create module registry table
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

-- Step 6: Insert core modules from configuration
INSERT INTO public.modules (key, name, description, routes, exports, reports) VALUES
('maps', 'Maps Module', 'Interactive mapping and geospatial visualization', ARRAY['maps'], ARRAY['png'], ARRAY[]::TEXT[]),
('data', 'Data Management', 'Geological and geospatial data management', ARRAY['data'], ARRAY['gpkg', 'geojson', 'cog', 'mvt'], ARRAY[]::TEXT[]),
('ai', 'AI & Prospectivity', 'AI-powered mineral prospectivity analysis', ARRAY['ai'], ARRAY['cog_prospectivity', 'cog_uncertainty', 'csv_targets', 'png_map'], ARRAY['target_pack_pdf']),
('drill', 'Drilling Management', 'Drill program planning and tracking', ARRAY['drill'], ARRAY['csv', 'xlsx', 'gpkg_collars', 'gltf_paths', 'pdf_drill_summary'], ARRAY['progress_pdf']),
('lims', 'Laboratory Information Management', 'Sample tracking and QA/QC', ARRAY['lims'], ARRAY['csv_clean', 'xlsx_clean', 'json_qc_flags', 'pdf_qaqc'], ARRAY['qaqc_pdf']),
('reports', 'Reporting', 'Executive and technical reporting', ARRAY['reports'], ARRAY['pdf'], ARRAY['exec_kpi_pdf', 'investor_update_pdf'])
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  routes = EXCLUDED.routes,
  exports = EXCLUDED.exports,
  reports = EXCLUDED.reports,
  updated_at = now();

-- Step 7: Update feature flags with configuration-based flags
INSERT INTO public.feature_flags (name, description, enabled, module, metadata) VALUES
('FEATURE_MAPS', 'Interactive mapping capabilities', true, 'maps', '{"priority": "high"}'),
('FEATURE_DATA', 'Data management and ingestion', true, 'data', '{"priority": "high"}'),
('FEATURE_AI', 'AI and machine learning features', true, 'ai', '{"priority": "high"}'),
('FEATURE_DRILL', 'Drilling data management', true, 'drill', '{"priority": "medium"}'),
('FEATURE_LIMS', 'Laboratory information management', true, 'lims', '{"priority": "medium"}'),
('FEATURE_REPORTS', 'Advanced reporting system', true, 'reports', '{"priority": "high"}'),
('FEATURE_TRIALS', 'Trial and subscription management', true, 'reports', '{"priority": "high"}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  module = EXCLUDED.module,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Step 8: Add performance indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_region ON public.organizations(region);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_exploration_sites_org_id ON public.exploration_sites(org_id);
CREATE INDEX IF NOT EXISTS idx_modules_key ON public.modules(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_module ON public.feature_flags(module);