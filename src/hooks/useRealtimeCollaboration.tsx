import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CollaborationMessage {
  id: string;
  user_id: string;
  project_id?: string;
  message: string;
  message_type: 'chat' | 'annotation' | 'system';
  metadata?: any;
  created_at: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

interface UserPresence {
  user_id: string;
  project_id?: string;
  status: 'online' | 'away' | 'offline';
  current_page?: string;
  cursor_position?: { x: number; y: number };
  last_seen: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

export const useRealtimeCollaboration = (projectId?: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CollaborationMessage[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch existing messages
  const fetchMessages = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('collaboration_messages')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Send a message
  const sendMessage = async (message: string, messageType: 'chat' | 'annotation' = 'chat', metadata?: any) => {
    if (!user || !projectId) return;

    try {
      const { error } = await supabase
        .from('collaboration_messages')
        .insert({
          user_id: user.id,
          project_id: projectId,
          message,
          message_type: messageType,
          metadata
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Update user presence
  const updatePresence = async (status: 'online' | 'away' | 'offline', currentPage?: string, cursorPosition?: { x: number; y: number }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          project_id: projectId,
          status,
          current_page: currentPage,
          cursor_position: cursorPosition,
          last_seen: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  // Fetch current presence
  const fetchPresence = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('user_presence')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .eq('status', 'online')
        .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Active in last 5 minutes

      if (error) throw error;
      setPresence(data || []);
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('collaboration-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'collaboration_messages',
          filter: `project_id=eq.${projectId}`
        },
        async (payload) => {
          // Fetch the complete message with profile data
          const { data } = await supabase
            .from('collaboration_messages')
            .select(`
              *,
              profiles:user_id (
                id,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages(prev => [...prev, data]);
          }
        }
      )
      .subscribe();

    // Subscribe to presence updates
    const presenceChannel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchPresence(); // Refetch presence on any change
        }
      )
      .subscribe();

    // Initial data fetch
    fetchMessages();
    fetchPresence();

    // Set user as online when component mounts
    if (user) {
      updatePresence('online', window.location.pathname);
    }

    setLoading(false);

    // Cleanup function
    return () => {
      // Set user as offline when component unmounts
      if (user) {
        updatePresence('offline');
      }
      
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [projectId, user]);

  // Update presence when user moves mouse (for cursor tracking)
  useEffect(() => {
    if (!user || !projectId) return;

    let lastUpdate = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastUpdate > 1000) { // Throttle to once per second
        updatePresence('online', window.location.pathname, { x: e.clientX, y: e.clientY });
        lastUpdate = now;
      }
    };

    // Update presence when page becomes visible/hidden
    const handleVisibilityChange = () => {
      updatePresence(document.hidden ? 'away' : 'online', window.location.pathname);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, projectId]);

  return {
    messages,
    presence,
    loading,
    sendMessage,
    updatePresence,
    refetch: () => {
      fetchMessages();
      fetchPresence();
    }
  };
};