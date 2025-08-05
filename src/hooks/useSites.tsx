import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Database } from '@/integrations/supabase/types';

type ExplorationSite = Database['public']['Tables']['exploration_sites']['Row'];
type SiteType = Database['public']['Enums']['site_type'];

export interface Site extends Omit<ExplorationSite, 'location' | 'area'> {
  location: any; // PostGIS geometry type
  area: any; // PostGIS geometry type (nullable in DB)
}

export interface CreateSiteData {
  project_id: string;
  name: string;
  site_type: SiteType;
  location: any; // PostGIS geometry object
  elevation?: number;
  area?: any; // PostGIS geometry object
  access_notes?: string;
}

export interface UpdateSiteData {
  id: string;
  name?: string;
  site_type?: SiteType;
  location?: any; // PostGIS geometry object
  elevation?: number;
  area?: any; // PostGIS geometry object
  access_notes?: string;
}

export const useSites = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const { toast } = useToast();

  const fetchSites = async (projectId?: string) => {
    try {
      setLoading(true);
      let query = supabase
        .from('exploration_sites')
        .select('*')
        .order('updated_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sites. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSite = async (siteData: CreateSiteData) => {
    try {
      const { data, error } = await supabase
        .from('exploration_sites')
        .insert([{
          ...siteData,
          created_by: (await supabase.auth.getUser()).data.user?.id || '',
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setSites(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Site created successfully.",
      });

      return data;
    } catch (error) {
      console.error('Error creating site:', error);
      toast({
        title: "Error",
        description: "Failed to create site. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateSite = async (siteData: UpdateSiteData) => {
    try {
      const { data, error } = await supabase
        .from('exploration_sites')
        .update({
          name: siteData.name,
          site_type: siteData.site_type,
          location: siteData.location,
          elevation: siteData.elevation,
          area: siteData.area,
          access_notes: siteData.access_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteData.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setSites(prev => prev.map(site => 
        site.id === siteData.id ? data : site
      ));

      toast({
        title: "Success",
        description: "Site updated successfully.",
      });

      return data;
    } catch (error) {
      console.error('Error updating site:', error);
      toast({
        title: "Error",
        description: "Failed to update site. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteSite = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from('exploration_sites')
        .delete()
        .eq('id', siteId);

      if (error) {
        throw error;
      }

      setSites(prev => prev.filter(site => site.id !== siteId));
      
      if (selectedSite?.id === siteId) {
        setSelectedSite(null);
      }

      toast({
        title: "Success",
        description: "Site deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting site:', error);
      toast({
        title: "Error",
        description: "Failed to delete site. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getSiteStats = () => {
    const stats = {
      total: sites.length,
      drilling: sites.filter(s => s.site_type === 'drilling').length,
      sampling: sites.filter(s => s.site_type === 'surface_sampling').length,
      geophysics: sites.filter(s => s.site_type === 'geophysics').length,
      geochemistry: sites.filter(s => s.site_type === 'geochemistry').length,
      remote_sensing: sites.filter(s => s.site_type === 'remote_sensing').length,
    };

    return stats;
  };

  useEffect(() => {
    fetchSites();
  }, []);

  return {
    sites,
    loading,
    selectedSite,
    setSelectedSite,
    fetchSites,
    createSite,
    updateSite,
    deleteSite,
    getSiteStats,
  };
};