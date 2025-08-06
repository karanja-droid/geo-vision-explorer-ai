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

-- Create basic policies for collaboration_messages
CREATE POLICY "Users can view messages in their projects" 
ON public.collaboration_messages 
FOR SELECT 
USING (
  project_id IS NULL OR 
  project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

CREATE POLICY "Users can create messages" 
ON public.collaboration_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create basic policies for user_presence
CREATE POLICY "Users can view presence" 
ON public.user_presence 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own presence" 
ON public.user_presence 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER TABLE public.collaboration_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;