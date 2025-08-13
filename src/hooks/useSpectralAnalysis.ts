import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SpectralData {
  id: string;
  site_id: string;
  data_type: 'hyperspectral' | 'multispectral' | 'lidar';
  wavelength_range: [number, number];
  spectral_bands: number;
  spatial_resolution: number;
  acquisition_date: string;
  sensor_type: string;
  raw_data_url: string;
  processed_data_url?: string;
  processing_status: 'raw' | 'processing' | 'processed' | 'analyzed';
  metadata: Record<string, any>;
}

export interface AnalysisResult {
  id: string;
  spectral_data_id: string;
  analysis_type: 'mineral_detection' | 'rock_classification' | 'structural_analysis';
  detected_features: any;
  confidence_map_url?: string;
  processing_time_seconds: number;
  model_version: string;
  created_at: string;
}

export const useSpectralAnalysis = (siteId: string) => {
  const queryClient = useQueryClient();

  // Fetch spectral data for a site
  const {
    data: spectralData,
    isLoading: spectralLoading,
    error: spectralError
  } = useQuery({
    queryKey: ['spectral-data', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spectral_data')
        .select('*')
        .eq('site_id', siteId)
        .order('acquisition_date', { ascending: false });
      
      if (error) throw error;
      return data as SpectralData[];
    },
    enabled: !!siteId
  });

  // Fetch analysis results
  const {
    data: analysisResults,
    isLoading: resultsLoading
  } = useQuery({
    queryKey: ['spectral-analysis-results', siteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cv_analysis_results')
        .select(`
          *,
          spectral_data!inner(site_id)
        `)
        .eq('spectral_data.site_id', siteId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AnalysisResult[];
    },
    enabled: !!siteId
  });

  // Trigger AI analysis
  const triggerAnalysis = useMutation({
    mutationFn: async ({
      spectralDataId,
      analysisType,
      modelVersion = 'latest'
    }: {
      spectralDataId: string;
      analysisType: 'mineral_detection' | 'rock_classification' | 'structural_analysis';
      modelVersion?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-mineral-analysis', {
        body: {
          spectralDataId,
          analysisType,
          modelVersion
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Analysis completed with ${(data.confidence * 100).toFixed(1)}% confidence`);
      queryClient.invalidateQueries({ queryKey: ['spectral-analysis-results', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  // Upload spectral data
  const uploadSpectralData = useMutation({
    mutationFn: async (spectralData: Omit<SpectralData, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('spectral_data')
        .insert(spectralData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Spectral data uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['spectral-data', siteId] });
    },
    onError: (error: any) => {
      toast.error(`Upload failed: ${error.message}`);
    }
  });

  // Update processing status
  const updateProcessingStatus = useMutation({
    mutationFn: async ({
      spectralDataId,
      status
    }: {
      spectralDataId: string;
      status: SpectralData['processing_status'];
    }) => {
      const { data, error } = await supabase
        .from('spectral_data')
        .update({ processing_status: status })
        .eq('id', spectralDataId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spectral-data', siteId] });
    }
  });

  return {
    // Data
    spectralData,
    analysisResults,
    
    // Loading states
    spectralLoading,
    resultsLoading,
    isAnalyzing: triggerAnalysis.isPending,
    isUploading: uploadSpectralData.isPending,
    
    // Error states
    spectralError,
    
    // Actions
    triggerAnalysis: triggerAnalysis.mutate,
    uploadSpectralData: uploadSpectralData.mutate,
    updateProcessingStatus: updateProcessingStatus.mutate,
    
    // Computed values
    totalSpectralDatasets: spectralData?.length || 0,
    completedAnalyses: analysisResults?.length || 0,
    averageConfidence: analysisResults?.reduce((sum, result) => {
      // Assuming confidence is stored in detected_features
      const confidence = result.detected_features?.overallConfidence || 0;
      return sum + confidence;
    }, 0) / Math.max(analysisResults?.length || 1, 1) || 0,
    
    // Recent activity
    recentAnalyses: analysisResults?.slice(0, 5) || [],
    pendingProcessing: spectralData?.filter(d => d.processing_status === 'processing').length || 0
  };
};