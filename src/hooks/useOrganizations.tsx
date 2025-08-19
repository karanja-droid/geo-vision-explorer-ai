import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  region: string;
  country_code: string;
  subscription_tier: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useOrganizations() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchOrganizations();
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get user's organization through their profile
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          org_id,
          organizations (*)
        `)
        .eq('user_id', user?.id)
        .single();

      if (profile?.organizations) {
        const org = profile.organizations as Organization;
        setOrganizations([org]);
        setCurrentOrg(org);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
    }
  };

  return {
    organizations,
    currentOrg,
    loading,
    switchOrganization,
    refetch: fetchOrganizations
  };
}