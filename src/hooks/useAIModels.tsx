import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface AIModel {
  id: string;
  name: string;
  version: string;
  model_type: string;
  training_data_info: any;
  performance_metrics: any;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAIModelData {
  name: string;
  version: string;
  model_type: string;
  training_data_info?: any;
  performance_metrics?: any;
  is_active?: boolean;
}

export interface UpdateAIModelData {
  id: string;
  name?: string;
  version?: string;
  model_type?: string;
  training_data_info?: any;
  performance_metrics?: any;
  is_active?: boolean;
}

export const useAIModels = () => {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchModels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_models')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching AI models:', error);
      toast({
        title: "Error",
        description: "Failed to fetch AI models",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createModel = async (modelData: CreateAIModelData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ai_models')
        .insert([{ ...modelData, created_by: user.id }])
        .select()
        .single();

      if (error) throw error;

      setModels(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "AI model created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating AI model:', error);
      toast({
        title: "Error",
        description: "Failed to create AI model",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateModel = async (modelData: UpdateAIModelData) => {
    try {
      const { id, ...updateData } = modelData;
      const { data, error } = await supabase
        .from('ai_models')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setModels(prev => prev.map(model => 
        model.id === id ? data : model
      ));
      toast({
        title: "Success",
        description: "AI model updated successfully",
      });
      return data;
    } catch (error) {
      console.error('Error updating AI model:', error);
      toast({
        title: "Error",
        description: "Failed to update AI model",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getActiveModels = () => {
    return models.filter(model => model.is_active);
  };

  const getModelStats = () => {
    const totalModels = models.length;
    const activeModels = models.filter(m => m.is_active).length;
    const avgAccuracy = models.length > 0 
      ? models.reduce((acc, model) => {
          const accuracy = model.performance_metrics?.accuracy || 0;
          return acc + accuracy;
        }, 0) / models.length
      : 0;

    return {
      totalModels,
      activeModels,
      avgAccuracy: Number(avgAccuracy.toFixed(1)),
      trainingModels: models.filter(m => !m.is_active).length
    };
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    loading,
    createModel,
    updateModel,
    getActiveModels,
    getModelStats,
    refetch: fetchModels
  };
};