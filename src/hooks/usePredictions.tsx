import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface Prediction {
  id: string;
  model_id: string;
  site_id: string;
  prediction_data: any;
  confidence_score: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePredictionData {
  model_id: string;
  site_id: string;
  prediction_data: any;
  confidence_score?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface UpdatePredictionData {
  id: string;
  prediction_data?: any;
  confidence_score?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export const usePredictions = (siteId?: string) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('predictions')
        .select('*')
        .order('created_at', { ascending: false });

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPredictions(data || []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch predictions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createPrediction = async (predictionData: CreatePredictionData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('predictions')
        .insert([{ ...predictionData, created_by: user.id }])
        .select()
        .single();

      if (error) throw error;

      setPredictions(prev => [data, ...prev]);
      toast({
        title: "Success",
        description: "Prediction created successfully",
      });
      return data;
    } catch (error) {
      console.error('Error creating prediction:', error);
      toast({
        title: "Error",
        description: "Failed to create prediction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updatePrediction = async (predictionData: UpdatePredictionData) => {
    try {
      const { id, ...updateData } = predictionData;
      const { data, error } = await supabase
        .from('predictions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPredictions(prev => prev.map(prediction => 
        prediction.id === id ? data : prediction
      ));
      toast({
        title: "Success",
        description: "Prediction updated successfully",
      });
      return data;
    } catch (error) {
      console.error('Error updating prediction:', error);
      toast({
        title: "Error",
        description: "Failed to update prediction",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getPredictionStats = () => {
    const total = predictions.length;
    const completed = predictions.filter(p => p.status === 'completed').length;
    const pending = predictions.filter(p => p.status === 'pending').length;
    const failed = predictions.filter(p => p.status === 'failed').length;
    const avgConfidence = predictions.length > 0
      ? predictions.reduce((acc, p) => acc + (p.confidence_score || 0), 0) / predictions.length
      : 0;

    return {
      total,
      completed,
      pending,
      failed,
      avgConfidence: Number(avgConfidence.toFixed(1))
    };
  };

  const getHighConfidencePredictions = (threshold = 80) => {
    return predictions.filter(p => (p.confidence_score || 0) >= threshold);
  };

  useEffect(() => {
    fetchPredictions();
  }, [siteId]);

  return {
    predictions,
    loading,
    createPrediction,
    updatePrediction,
    getPredictionStats,
    getHighConfidencePredictions,
    refetch: fetchPredictions
  };
};