-- Phase 1A: Add basic multi-tenant structure
-- First add columns, then create policies

-- Add org_id to profiles table first
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS org_id UUID;

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

-- Now add the foreign key constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_org_id 
FOREIGN KEY (org_id) REFERENCES public.organizations(id);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add multi-tenant fields to other tables
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'ZA',
ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal' 
CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted'));

ALTER TABLE public.exploration_sites 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

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

-- Update feature_flags table structure
ALTER TABLE public.feature_flags 
ADD COLUMN IF NOT EXISTS module TEXT,
ADD COLUMN IF NOT EXISTS tier_restrictions TEXT[],
ADD COLUMN IF NOT EXISTS user_restrictions UUID[];

-- Create function to get current user organization
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

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
('FEATURE_REPORTS', 'Advanced reporting system', true, 'reports', '{"priority": "high"}'),
('FEATURE_ADMIN', 'Administration interface', true, 'admin', '{"priority": "high"}')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled,
  module = EXCLUDED.module,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_region ON public.organizations(region);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_exploration_sites_org_id ON public.exploration_sites(org_id);
CREATE INDEX IF NOT EXISTS idx_modules_key ON public.modules(key);
CREATE INDEX IF NOT EXISTS idx_modules_enabled ON public.modules(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_module ON public.feature_flags(module);