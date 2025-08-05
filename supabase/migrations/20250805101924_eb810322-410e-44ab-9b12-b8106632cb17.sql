-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix RLS policies for missing tables - Enable RLS for PostGIS spatial_ref_sys table if accessible
-- Note: PostGIS tables are usually in public schema but managed by the extension
-- We'll focus on ensuring our custom tables have proper RLS which they already do

-- Create missing RLS policies for complete coverage
CREATE POLICY "Users can insert their own activity logs" 
    ON public.activity_logs 
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

-- Create additional policies for mineral deposits
CREATE POLICY "Users can create mineral deposits in accessible sites" 
    ON public.mineral_deposits 
    FOR INSERT 
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Create additional policies for predictions
CREATE POLICY "Users can create predictions for accessible sites" 
    ON public.predictions 
    FOR INSERT 
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Create additional policies for collaboration sessions
CREATE POLICY "Users can create collaboration sessions for accessible projects" 
    ON public.collaboration_sessions 
    FOR INSERT 
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Add UPDATE policies where missing
CREATE POLICY "Users can update sites in accessible projects" 
    ON public.exploration_sites 
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

CREATE POLICY "Users can update deposits in accessible sites" 
    ON public.mineral_deposits 
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

CREATE POLICY "Authorized users can update AI models" 
    ON public.ai_models 
    FOR UPDATE 
    USING (
        created_by = auth.uid() OR
        public.get_current_user_role() = 'admin'
    );

CREATE POLICY "Users can update predictions for accessible sites" 
    ON public.predictions 
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

CREATE POLICY "Users can update collaboration sessions they created" 
    ON public.collaboration_sessions 
    FOR UPDATE 
    USING (
        created_by = auth.uid() OR
        auth.uid() = ANY(participants) OR
        public.get_current_user_role() = 'admin'
    );