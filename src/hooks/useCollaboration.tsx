import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface CollaborationSession {
  id: string;
  project_id: string;
  session_name: string;
  created_by: string;
  participants: string[];
  is_active: boolean;
  session_data: any;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateSessionData {
  project_id: string;
  session_name: string;
  participants?: string[];
  session_data?: any;
}

export const useCollaboration = (projectId?: string) => {
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('collaboration_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching collaboration sessions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch collaboration sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setActivities((data || []).map(activity => ({
        ...activity,
        ip_address: (activity.ip_address as string) || null,
        user_agent: (activity.user_agent as string) || null
      })));
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const createSession = async (sessionData: CreateSessionData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('collaboration_sessions')
        .insert([{ 
          ...sessionData, 
          created_by: user.id,
          participants: [user.id, ...(sessionData.participants || [])]
        }])
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Collaboration session created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating collaboration session:', error);
      toast({
        title: "Error",
        description: "Failed to create collaboration session",
        variant: "destructive",
      });
      throw error;
    }
  };

  const joinSession = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const session = sessions.find(s => s.id === sessionId);
      if (!session) throw new Error('Session not found');

      const updatedParticipants = [...new Set([...session.participants, user.id])];

      const { data, error } = await supabase
        .from('collaboration_sessions')
        .update({ participants: updatedParticipants })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => prev.map(s => s.id === sessionId ? data : s));
      return data;
    } catch (error) {
      console.error('Error joining session:', error);
      toast({
        title: "Error",
        description: "Failed to join session",
        variant: "destructive",
      });
      throw error;
    }
  };

  const leaveSession = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const session = sessions.find(s => s.id === sessionId);
      if (!session) throw new Error('Session not found');

      const updatedParticipants = session.participants.filter(p => p !== user.id);

      const { data, error } = await supabase
        .from('collaboration_sessions')
        .update({ 
          participants: updatedParticipants,
          is_active: updatedParticipants.length > 0
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      setSessions(prev => prev.map(s => s.id === sessionId ? data : s));
      return data;
    } catch (error) {
      console.error('Error leaving session:', error);
      toast({
        title: "Error",
        description: "Failed to leave session",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logActivity = async (activityData: {
    entity_type: string;
    entity_id: string;
    action: string;
    details?: any;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('activity_logs')
        .insert([{
          ...activityData,
          user_id: user.id,
          ip_address: '0.0.0.0', // Would be populated by edge function
          user_agent: navigator.userAgent
        }]);
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  // Mock active users for now - in real implementation would use presence
  useEffect(() => {
    setActiveUsers([
      { id: '1', name: 'Dr. Sarah Chen', role: 'Senior Geologist', status: 'online', activity: 'Analyzing Site Alpha' },
      { id: '2', name: 'Mike Rodriguez', role: 'GIS Specialist', status: 'online', activity: 'Updating mineral layers' },
      { id: '3', name: 'Emily Zhang', role: 'Data Scientist', status: 'away', activity: 'Training ML models' },
    ]);
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchActivities();
  }, [projectId]);

  return {
    sessions,
    activities,
    activeUsers,
    loading,
    createSession,
    joinSession,
    leaveSession,
    logActivity,
    refetch: () => {
      fetchSessions();
      fetchActivities();
    }
  };
};