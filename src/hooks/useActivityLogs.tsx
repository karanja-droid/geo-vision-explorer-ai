import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ActivityLog {
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

interface CreateActivityLogData {
  entity_type: string;
  entity_id: string;
  action: string;
  details?: any;
}

export const useActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchLogs = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching activity logs:', error);
        return;
      }

      setLogs((data || []).map(log => ({
        ...log,
        ip_address: log.ip_address as string | null
      })));
    } catch (error) {
      console.error('Error in fetchLogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLog = async (logData: CreateActivityLogData) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert([{
          user_id: user.id,
          ...logData,
          user_agent: navigator.userAgent,
        }]);

      if (error) {
        console.error('Error creating activity log:', error);
        return;
      }

      // Refresh logs to include the new one
      await fetchLogs();
    } catch (error) {
      console.error('Error in createLog:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  return {
    logs,
    loading,
    createLog,
    refetch: fetchLogs
  };
};