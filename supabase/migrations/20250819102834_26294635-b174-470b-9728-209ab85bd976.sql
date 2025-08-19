-- Phase 1: Simplified Core Infrastructure
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

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Add org_id to existing tables
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'ZA',
ADD COLUMN IF NOT EXISTS data_classification TEXT DEFAULT 'internal';

ALTER TABLE public.exploration_sites 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id);

-- Create function for organization access
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create basic organizations policies
CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  id = get_current_user_org_id() OR 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Admins can manage organizations" 
ON public.organizations 
FOR ALL 
USING (get_current_user_role() = 'admin');

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
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view enabled modules" 
ON public.modules 
FOR SELECT 
USING (enabled = true);

-- Insert core modules
INSERT INTO public.modules (key, name, description, routes, exports, reports) VALUES
('maps', 'Maps Module', 'Interactive mapping', ARRAY['maps'], ARRAY['png'], ARRAY[]::TEXT[]),
('data', 'Data Management', 'Data management', ARRAY['data'], ARRAY['csv', 'json'], ARRAY[]::TEXT[]),
('ai', 'AI Module', 'AI analysis', ARRAY['ai'], ARRAY['csv'], ARRAY['pdf']),
('reports', 'Reporting', 'Reporting system', ARRAY['reports'], ARRAY['pdf'], ARRAY['pdf'])
ON CONFLICT (key) DO NOTHING;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_modules_key ON public.modules(key);