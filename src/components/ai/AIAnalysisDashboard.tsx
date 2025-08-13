import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Microscope, Cpu, Brain, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIAnalysisDashboardProps {
  projectId: string;
}

interface AnalysisJob {
  id: string;
  analysis_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence_score?: number;
  created_at: string;
  processing_time_seconds?: number;
  llm_model?: string;
}

interface ModelPerformance {
  model_name: string;
  analysis_type: string;
  total_requests: number;
  average_confidence: number;
  user_satisfaction_avg: number;
}

const AIAnalysisDashboard: React.FC<AIAnalysisDashboardProps> = ({ projectId }) => {
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string>('mineral_detection');
  const queryClient = useQueryClient();

  // Fetch recent analyses
  const { data: recentAnalyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['ai-analyses', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cv_analysis_results')
        .select(`
          *,
          spectral_data:spectral_data_id (
            site_id,
            data_type,
            acquisition_date
          )
        `)
        .eq('spectral_data.site_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch LLM analyses
  const { data: llmAnalyses, isLoading: llmLoading } = useQuery({
    queryKey: ['llm-analyses', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_analysis_results')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch model performance
  const { data: modelPerformance } = useQuery({
    queryKey: ['model-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_model_performance')
        .select('*')
        .order('total_requests', { ascending: false });
      
      if (error) throw error;
      return data as ModelPerformance[];
    }
  });

  // Trigger new analysis
  const triggerAnalysis = useMutation({
    mutationFn: async ({ analysisType, spectralDataId }: { analysisType: string; spectralDataId: string }) => {
      const { data, error } = await supabase.functions.invoke('ai-mineral-analysis', {
        body: {
          spectralDataId,
          analysisType,
          modelVersion: 'latest'
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Analysis started successfully');
      queryClient.invalidateQueries({ queryKey: ['ai-analyses', projectId] });
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  // Trigger LLM geological analysis
  const triggerLLMAnalysis = useMutation({
    mutationFn: async ({ analysisType, data, context }: any) => {
      const { data: result, error } = await supabase.functions.invoke('llm-geological-analysis', {
        body: {
          analysisType,
          data,
          context: {
            projectId,
            ...context
          }
        }
      });
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('LLM analysis completed');
      queryClient.invalidateQueries({ queryKey: ['llm-analyses', projectId] });
    },
    onError: (error) => {
      toast.error(`LLM analysis failed: ${error.message}`);
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Analysis Dashboard</h2>
          <p className="text-muted-foreground">
            Advanced geological analysis powered by AI and machine learning
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => triggerAnalysis.mutate({
              analysisType: selectedAnalysisType,
              spectralDataId: 'sample-spectral-id' // In real app, this would be selected
            })}
            disabled={triggerAnalysis.isPending}
          >
            <Microscope className="h-4 w-4 mr-2" />
            {triggerAnalysis.isPending ? 'Processing...' : 'Start Analysis'}
          </Button>
          <Button
            variant="outline"
            onClick={() => triggerLLMAnalysis.mutate({
              analysisType: 'core_interpretation',
              data: { coreData: [] },
              context: { siteLocation: 'Sample Site', geologicalSetting: 'Archean greenstone' }
            })}
            disabled={triggerLLMAnalysis.isPending}
          >
            <Brain className="h-4 w-4 mr-2" />
            {triggerLLMAnalysis.isPending ? 'Consulting...' : 'LLM Consultation'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="analyses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analyses">Recent Analyses</TabsTrigger>
          <TabsTrigger value="llm">LLM Consultations</TabsTrigger>
          <TabsTrigger value="performance">Model Performance</TabsTrigger>
          <TabsTrigger value="queue">Processing Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="analyses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysesLoading ? (
              <div className="col-span-full text-center py-8">Loading analyses...</div>
            ) : recentAnalyses?.map((analysis) => (
              <Card key={analysis.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {analysis.analysis_type.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    {getStatusIcon('completed')}
                  </div>
                  <CardDescription>
                    {analysis.spectral_data?.data_type} • {new Date(analysis.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Confidence</span>
                      <span className={getConfidenceColor(0.85)}>85%</span>
                    </div>
                    <Progress value={85} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Processing: {analysis.processing_time_seconds}s</span>
                      <Badge variant="secondary">{analysis.model_version || 'v1.0'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="llm" className="space-y-4">
          <div className="grid gap-4">
            {llmLoading ? (
              <div className="text-center py-8">Loading LLM analyses...</div>
            ) : llmAnalyses?.map((analysis) => (
              <Card key={analysis.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {analysis.analysis_type.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{analysis.llm_model}</Badge>
                      <Badge variant={analysis.validation_status === 'validated' ? 'default' : 'secondary'}>
                        {analysis.validation_status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Confidence: {(analysis.confidence_score * 100).toFixed(1)}% • 
                    {new Date(analysis.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium mb-2">Analysis Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        {analysis.llm_response?.analysis?.substring(0, 200)}...
                      </p>
                    </div>
                    {analysis.llm_response?.recommendations && (
                      <div>
                        <h4 className="font-medium mb-2">Key Recommendations</h4>
                        <ul className="text-sm space-y-1">
                          {analysis.llm_response.recommendations.slice(0, 3).map((rec: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-muted-foreground">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {modelPerformance?.map((model) => (
              <Card key={`${model.model_name}-${model.analysis_type}`}>
                <CardHeader>
                  <CardTitle className="text-lg">{model.model_name}</CardTitle>
                  <CardDescription>{model.analysis_type.replace('_', ' ')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Total Requests</span>
                      <span className="font-medium">{model.total_requests}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg Confidence</span>
                      <span className={getConfidenceColor(model.average_confidence)}>
                        {(model.average_confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>User Satisfaction</span>
                      <span className="font-medium">
                        {model.user_satisfaction_avg?.toFixed(1) || 'N/A'}/5.0
                      </span>
                    </div>
                    <Progress 
                      value={model.average_confidence * 100} 
                      className="h-2" 
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="queue" className="space-y-4">
          <Alert>
            <Cpu className="h-4 w-4" />
            <AlertDescription>
              Processing queue is currently empty. All analyses are completed.
            </AlertDescription>
          </Alert>
          
          <Card>
            <CardHeader>
              <CardTitle>Queue Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">0</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-muted-foreground">Processing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">24</div>
                  <div className="text-sm text-muted-foreground">Completed Today</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIAnalysisDashboard;