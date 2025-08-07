import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface SecurityAuditReport {
  timestamp: string;
  rls_status: Array<{
    table_name: string;
    rls_enabled: boolean;
    policy_count: number;
  }>;
  recent_security_events: Array<{
    event_type: string;
    table_name: string;
    user_id: string;
    timestamp: string;
    details: any;
  }>;
  encryption_status: {
    encrypted_tables: string[];
    key_rotation_history: Array<{
      timestamp: string;
      tables_affected: string[];
    }>;
  };
  rate_limit_violations: Array<{
    user_id: string;
    endpoint: string;
    violation_count: number;
    last_violation: string;
  }>;
}

interface AuditSummary {
  total_tables_checked: number;
  tables_without_rls: number;
  recent_security_events: number;
  encrypted_tables: number;
  rate_limit_violations: number;
}

export const useSecurityAudit = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();

  const generateAuditReport = async () => {
    if (!session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate security audit report",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('security-audit', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setReport(data.report);
        setSummary(data.summary);
        toast({
          title: "Security Audit Complete",
          description: `Analyzed ${data.summary.total_tables_checked} tables with ${data.summary.recent_security_events} recent security events`,
        });
      } else {
        throw new Error(data.error || 'Audit failed');
      }
    } catch (error) {
      console.error('Security audit error:', error);
      toast({
        title: "Audit Failed",
        description: error instanceof Error ? error.message : "Failed to generate security audit report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkRLSStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('check_rls_status');
      
      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('RLS status check error:', error);
      toast({
        title: "RLS Check Failed",
        description: "Failed to check Row Level Security status",
        variant: "destructive"
      });
      return [];
    }
  };

  const getAuditLogs = async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Audit logs fetch error:', error);
      toast({
        title: "Audit Logs Failed",
        description: "Failed to fetch audit logs",
        variant: "destructive"
      });
      return [];
    }
  };

  const rotateEncryptionKey = async (oldKey: string, newKey: string) => {
    if (!session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to rotate encryption keys",
        variant: "destructive"
      });
      return false;
    }

    try {
      const { error } = await supabase.rpc('rotate_encryption_key', {
        old_key: oldKey,
        new_key: newKey
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Key Rotation Successful",
        description: "Encryption keys have been rotated successfully",
      });

      return true;
    } catch (error) {
      console.error('Key rotation error:', error);
      toast({
        title: "Key Rotation Failed",
        description: error instanceof Error ? error.message : "Failed to rotate encryption keys",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    loading,
    report,
    summary,
    generateAuditReport,
    checkRLSStatus,
    getAuditLogs,
    rotateEncryptionKey
  };
};