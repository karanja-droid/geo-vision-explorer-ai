-- Enable profiles table INSERT for new users
CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add new columns to profiles table for enhanced user management
ALTER TABLE public.profiles 
ADD COLUMN bio text,
ADD COLUMN expertise text[],
ADD COLUMN preferences jsonb DEFAULT '{}',
ADD COLUMN last_login_at timestamp with time zone,
ADD COLUMN timezone text DEFAULT 'UTC';

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  entity_type text,
  entity_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create documents table for file management
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL,
  project_id uuid,
  site_id uuid,
  tags text[],
  description text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for documents
CREATE POLICY "Users can view accessible documents" 
ON public.documents 
FOR SELECT 
USING (
  is_public = true OR 
  uploaded_by = auth.uid() OR 
  (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = documents.project_id 
    AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
  )) OR 
  get_current_user_role() = 'admin'
);

CREATE POLICY "Users can upload documents" 
ON public.documents 
FOR INSERT 
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their documents" 
ON public.documents 
FOR UPDATE 
USING (uploaded_by = auth.uid() OR get_current_user_role() = 'admin');

-- Create saved_filters table
CREATE TABLE public.saved_filters (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  filter_type text NOT NULL,
  filter_data jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on saved_filters
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;

-- Create policies for saved_filters
CREATE POLICY "Users can manage their own saved filters" 
ON public.saved_filters 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create report_templates table
CREATE TABLE public.report_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  template_data jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on report_templates
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for report_templates
CREATE POLICY "Users can view accessible report templates" 
ON public.report_templates 
FOR SELECT 
USING (is_public = true OR created_by = auth.uid() OR get_current_user_role() = 'admin');

CREATE POLICY "Users can create report templates" 
ON public.report_templates 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their report templates" 
ON public.report_templates 
FOR UPDATE 
USING (created_by = auth.uid() OR get_current_user_role() = 'admin');

-- Create team_members table for collaboration
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  permissions text[] DEFAULT '{}',
  invited_by uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Create policies for team_members
CREATE POLICY "Project owners can manage team members" 
ON public.team_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = team_members.project_id 
    AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

CREATE POLICY "Users can view team memberships" 
ON public.team_members 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = team_members.project_id 
    AND (p.owner_id = auth.uid() OR get_current_user_role() = 'admin')
  )
);

-- Add enhanced audit columns to activity_logs
ALTER TABLE public.activity_logs 
ADD COLUMN session_id text,
ADD COLUMN metadata jsonb DEFAULT '{}';

-- Create updated_at triggers for new tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_filters_updated_at
  BEFORE UPDATE ON public.saved_filters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'display_name', new.email),
    'geologist'::user_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();