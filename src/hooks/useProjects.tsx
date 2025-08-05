import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'completed' | 'suspended' | 'cancelled';
  owner_id: string;
  budget?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

interface CreateProjectData {
  name: string;
  description?: string;
  status?: Project['status'];
  budget?: number;
  start_date?: string;
  end_date?: string;
}

interface UpdateProjectData extends Partial<CreateProjectData> {
  id: string;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to fetch projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData: CreateProjectData) => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...projectData,
          owner_id: user.id,
          status: projectData.status || 'planning'
        }])
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Project created successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateProject = async (projectData: UpdateProjectData) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: projectData.name,
          description: projectData.description,
          status: projectData.status,
          budget: projectData.budget,
          start_date: projectData.start_date,
          end_date: projectData.end_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectData.id)
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => prev.map(p => p.id === data.id ? data : p));
      if (selectedProject?.id === data.id) {
        setSelectedProject(data);
      }
      
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
      
      return data;
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
      }
      
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
      return false;
    }
  };

  const getProjectStats = () => {
    const stats = {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      planning: projects.filter(p => p.status === 'planning').length,
      totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    };
    return stats;
  };

  return {
    projects,
    loading,
    selectedProject,
    setSelectedProject,
    createProject,
    updateProject,
    deleteProject,
    fetchProjects,
    getProjectStats
  };
};