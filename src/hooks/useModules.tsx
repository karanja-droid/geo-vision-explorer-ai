import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Module {
  id: string;
  key: string;
  name: string;
  description?: string;
  version: string;
  enabled: boolean;
  routes: string[];
  exports: string[];
  reports: string[];
  permissions: Record<string, any>;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('enabled', true)
        .order('name');

      if (error) throw error;

      setModules(data || []);
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleByKey = (key: string): Module | undefined => {
    return modules.find(m => m.key === key);
  };

  const isModuleEnabled = (key: string): boolean => {
    const module = getModuleByKey(key);
    return module?.enabled || false;
  };

  return {
    modules,
    loading,
    getModuleByKey,
    isModuleEnabled,
    refetch: fetchModules
  };
}