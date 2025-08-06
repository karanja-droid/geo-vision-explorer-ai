-- Create collaboration_messages table
CREATE TABLE IF NOT EXISTS public.collaboration_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'annotation', 'system')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  current_page TEXT,
  cursor_position JSONB,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Enable Row Level Security
ALTER TABLE public.collaboration_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Create policies for collaboration_messages
CREATE POLICY "Users can view messages in their projects" 
ON public.collaboration_messages 
FOR SELECT 
USING (
  project_id IS NULL OR 
  project_id IN (
    SELECT id FROM public.projects WHERE 
    user_id = auth.uid() OR 
    id IN (SELECT project_id FROM public.project_collaborators WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can create messages in their projects" 
ON public.collaboration_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    project_id IS NULL OR 
    project_id IN (
      SELECT id FROM public.projects WHERE 
      user_id = auth.uid() OR 
      id IN (SELECT project_id FROM public.project_collaborators WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can update their own messages" 
ON public.collaboration_messages 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" 
ON public.collaboration_messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for user_presence
CREATE POLICY "Users can view presence in their projects" 
ON public.user_presence 
FOR SELECT 
USING (
  project_id IS NULL OR 
  project_id IN (
    SELECT id FROM public.projects WHERE 
    user_id = auth.uid() OR 
    id IN (SELECT project_id FROM public.project_collaborators WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Users can manage their own presence" 
ON public.user_presence 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collaboration_messages_project_id ON public.collaboration_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_messages_created_at ON public.collaboration_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_user_presence_project_id ON public.user_presence(project_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_collaboration_messages_updated_at
BEFORE UPDATE ON public.collaboration_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for collaboration features
ALTER TABLE public.collaboration_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaboration_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;