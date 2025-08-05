-- Fix RLS security issues
-- Enable RLS on spatial_ref_sys and geometry_columns tables
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geometry_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geography_columns ENABLE ROW LEVEL SECURITY;

-- Create policies for spatial_ref_sys (read-only for authenticated users)
CREATE POLICY "Allow read access to spatial reference systems"
ON public.spatial_ref_sys
FOR SELECT
TO authenticated
USING (true);

-- Create policies for geometry_columns (read-only for authenticated users)
CREATE POLICY "Allow read access to geometry columns"
ON public.geometry_columns
FOR SELECT
TO authenticated
USING (true);

-- Create policies for geography_columns (read-only for authenticated users)
CREATE POLICY "Allow read access to geography columns"
ON public.geography_columns
FOR SELECT
TO authenticated
USING (true);

-- Update existing function to be security definer with proper search path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;