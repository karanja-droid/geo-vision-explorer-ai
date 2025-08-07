import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Permission {
  id: string;
  role: string;
  permission_category: string;
  permission_action: string;
  resource_type: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  conditions: any;
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address?: string | null;
  user_agent?: string | null;
  mfa_verified: boolean;
  last_activity: string;
  expires_at: string;
  created_at: string;
  is_active: boolean;
}

export interface MFASettings {
  id: string;
  user_id: string;
  mfa_enabled: boolean;
  backup_codes?: string[];
  totp_secret?: string;
  recovery_email?: string;
  last_backup_code_used_at?: string;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS = {
  admin: 'Administrator (Legacy)',
  administrator: 'Administrator',
  geologist: 'Geologist',
  geophysicist: 'Geophysicist',
  drilling_manager: 'Drilling Manager',
  qa_qc_specialist: 'QA/QC Specialist',
  environmental_officer: 'Environmental Officer',
  executive: 'Executive'
} as const;

export const useRolePermissions = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [mfaSettings, setMfaSettings] = useState<MFASettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user permissions
  const fetchPermissions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  // Fetch user sessions
  const fetchUserSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserSessions((data || []) as UserSession[]);
    } catch (error) {
      console.error('Error fetching user sessions:', error);
    }
  };

  // Fetch MFA settings
  const fetchMfaSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_mfa_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setMfaSettings(data);
    } catch (error) {
      console.error('Error fetching MFA settings:', error);
    }
  };

  // Check if user has specific permission
  const hasPermission = async (
    category: string,
    action: string,
    resource: string,
    actionType: 'create' | 'read' | 'update' | 'delete' = 'read'
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('user_has_permission', {
        p_permission_category: category,
        p_permission_action: action,
        p_resource_type: resource,
        p_action_type: actionType
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  // Enable MFA
  const enableMFA = async (totpSecret: string, recoveryEmail?: string) => {
    if (!user) return;

    try {
      // Generate cryptographically secure backup codes
      const backupCodes = Array.from({ length: 10 }, () => {
        const array = new Uint8Array(4);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 6).toUpperCase();
      });

      const { data, error } = await supabase
        .from('user_mfa_settings')
        .upsert({
          user_id: user.id,
          mfa_enabled: true,
          totp_secret: totpSecret,
          backup_codes: backupCodes,
          recovery_email: recoveryEmail
        })
        .select()
        .single();

      if (error) throw error;
      setMfaSettings(data);
      return { success: true, backupCodes };
    } catch (error) {
      console.error('Error enabling MFA:', error);
      return { success: false, error };
    }
  };

  // Disable MFA
  const disableMFA = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_mfa_settings')
        .update({
          mfa_enabled: false,
          totp_secret: null,
          backup_codes: null
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      setMfaSettings(data);
      return { success: true };
    } catch (error) {
      console.error('Error disabling MFA:', error);
      return { success: false, error };
    }
  };

  // Revoke session
  const revokeSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
      await fetchUserSessions();
      return { success: true };
    } catch (error) {
      console.error('Error revoking session:', error);
      return { success: false, error };
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPermissions(),
        fetchUserSessions(),
        fetchMfaSettings()
      ]);
      setLoading(false);
    };

    if (user) {
      loadData();
    }
  }, [user]);

  return {
    permissions,
    userSessions,
    mfaSettings,
    loading,
    hasPermission,
    enableMFA,
    disableMFA,
    revokeSession,
    refetch: () => Promise.all([
      fetchPermissions(),
      fetchUserSessions(),
      fetchMfaSettings()
    ])
  };
};