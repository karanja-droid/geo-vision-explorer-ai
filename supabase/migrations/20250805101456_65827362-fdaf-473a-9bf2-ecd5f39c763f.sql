-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create enum types
CREATE TYPE public.user_role AS ENUM ('admin', 'geologist', 'driller', 'qa_qc', 'executive', 'field_tech');
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'completed', 'suspended', 'cancelled');
CREATE TYPE public.site_type AS ENUM ('drilling', 'surface_sampling', 'geophysics', 'geochemistry', 'remote_sensing');
CREATE TYPE public.prediction_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create profiles table for user management
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    role user_role NOT NULL DEFAULT 'geologist',
    company TEXT,
    department TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status project_status NOT NULL DEFAULT 'planning',
    owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    budget DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exploration_sites table with geospatial data
CREATE TABLE public.exploration_sites (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    site_type site_type NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    area GEOGRAPHY(POLYGON, 4326),
    elevation DECIMAL(10,2),
    access_notes TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mineral_deposits table
CREATE TABLE public.mineral_deposits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.exploration_sites(id) ON DELETE CASCADE,
    mineral_type TEXT NOT NULL,
    grade_estimate DECIMAL(10,4),
    tonnage_estimate DECIMAL(15,2),
    confidence_level DECIMAL(3,2) CHECK (confidence_level >= 0 AND confidence_level <= 1),
    discovery_date DATE,
    notes TEXT,
    geochemistry_data JSONB,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_models table
CREATE TABLE public.ai_models (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    model_type TEXT NOT NULL,
    training_data_info JSONB,
    performance_metrics JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(name, version)
);

-- Create predictions table
CREATE TABLE public.predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id UUID NOT NULL REFERENCES public.ai_models(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.exploration_sites(id) ON DELETE CASCADE,
    prediction_data JSONB NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    status prediction_status NOT NULL DEFAULT 'pending',
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create collaboration_sessions table
CREATE TABLE public.collaboration_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    session_name TEXT NOT NULL,
    participants UUID[] NOT NULL DEFAULT '{}',
    session_data JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table for audit trail
CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exploration_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mineral_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'geologist')
    );
    RETURN NEW;
END;
$$;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exploration_sites_updated_at
    BEFORE UPDATE ON public.exploration_sites
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mineral_deposits_updated_at
    BEFORE UPDATE ON public.mineral_deposits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
    BEFORE UPDATE ON public.ai_models
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_predictions_updated_at
    BEFORE UPDATE ON public.predictions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_collaboration_sessions_updated_at
    BEFORE UPDATE ON public.collaboration_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
    ON public.profiles 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
    ON public.profiles 
    FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
    ON public.profiles 
    FOR SELECT 
    USING (public.get_current_user_role() = 'admin');

-- Create RLS policies for projects
CREATE POLICY "Users can view projects they own or participate in" 
    ON public.projects 
    FOR SELECT 
    USING (
        owner_id = auth.uid() OR 
        public.get_current_user_role() = 'admin'
    );

CREATE POLICY "Users can create projects" 
    ON public.projects 
    FOR INSERT 
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Project owners can update their projects" 
    ON public.projects 
    FOR UPDATE 
    USING (
        owner_id = auth.uid() OR 
        public.get_current_user_role() = 'admin'
    );

-- Create RLS policies for exploration_sites
CREATE POLICY "Users can view sites from accessible projects" 
    ON public.exploration_sites 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

CREATE POLICY "Users can create sites in accessible projects" 
    ON public.exploration_sites 
    FOR INSERT 
    WITH CHECK (
        created_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.projects p 
            WHERE p.id = project_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Create RLS policies for mineral_deposits
CREATE POLICY "Users can view deposits from accessible sites" 
    ON public.mineral_deposits 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Create RLS policies for ai_models
CREATE POLICY "Users can view AI models" 
    ON public.ai_models 
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Authorized users can create AI models" 
    ON public.ai_models 
    FOR INSERT 
    WITH CHECK (
        created_by = auth.uid() AND
        public.get_current_user_role() IN ('admin', 'geologist')
    );

-- Create RLS policies for predictions
CREATE POLICY "Users can view predictions from accessible sites" 
    ON public.predictions 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.exploration_sites es
            JOIN public.projects p ON es.project_id = p.id
            WHERE es.id = site_id 
            AND (p.owner_id = auth.uid() OR public.get_current_user_role() = 'admin')
        )
    );

-- Create RLS policies for collaboration_sessions
CREATE POLICY "Users can view collaboration sessions they participate in" 
    ON public.collaboration_sessions 
    FOR SELECT 
    USING (
        auth.uid() = ANY(participants) OR
        created_by = auth.uid() OR
        public.get_current_user_role() = 'admin'
    );

-- Create RLS policies for activity_logs
CREATE POLICY "Users can view their own activity logs" 
    ON public.activity_logs 
    FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity logs" 
    ON public.activity_logs 
    FOR SELECT 
    USING (public.get_current_user_role() = 'admin');

-- Create spatial indexes for performance
CREATE INDEX idx_exploration_sites_location ON public.exploration_sites USING GIST(location);
CREATE INDEX idx_exploration_sites_area ON public.exploration_sites USING GIST(area);
CREATE INDEX idx_exploration_sites_project_id ON public.exploration_sites(project_id);
CREATE INDEX idx_mineral_deposits_site_id ON public.mineral_deposits(site_id);
CREATE INDEX idx_predictions_site_id ON public.predictions(site_id);
CREATE INDEX idx_predictions_model_id ON public.predictions(model_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at);

-- Create indexes for better query performance
CREATE INDEX idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_ai_models_is_active ON public.ai_models(is_active);
CREATE INDEX idx_collaboration_sessions_project_id ON public.collaboration_sessions(project_id);
CREATE INDEX idx_collaboration_sessions_is_active ON public.collaboration_sessions(is_active);