import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Target, 
  Layers, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { AIInference } from './AIInference';
import { UncertaintyVisualization } from './UncertaintyVisualization';
import { ActiveLearningLabeler } from './ActiveLearningLabeler';

interface AIInferenceWithActiveLearningProps {
  onLayerToggle?: (layer: string, visible: boolean) => void;
  onOpacityChange?: (layer: string, opacity: number) => void;
}

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  component: string;
}

export const AIInferenceWithActiveLearning: React.FC<AIInferenceWithActiveLearningProps> = ({
  onLayerToggle,
  onOpacityChange
}) => {
  const [activeTab, setActiveTab] = useState('inference');
  const [inferenceResult, setInferenceResult] = useState<any>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    {
      id: 'inference',
      title: 'AI Inference',
      description: 'Generate prospectivity and uncertainty maps',
      status: 'active',
      component: 'inference'
    },
    {
      id: 'visualization',
      title: 'Uncertainty Visualization',
      description: 'Visualize and analyze uncertainty patterns',
      status: 'pending',
      component: 'visualization'
    },
    {
      id: 'labeling',
      title: 'Active Learning',
      description: 'Label high-uncertainty areas and retrain model',
      status: 'pending',
      component: 'labeling'
    },
    {
      id: 'improvement',
      title: 'Model Improvement',
      description: 'View performance improvements and new model',
      status: 'pending',
      component: 'improvement'
    }
  ]);
  const [retrainingResults, setRetrainingResults] = useState<any>(null);
  const { toast } = useToast();

  const updateWorkflowStep = (stepId: string, status: WorkflowStep['status']) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const handleInferenceComplete = (result: any) => {
    setInferenceResult(result);
    updateWorkflowStep('inference', 'completed');
    updateWorkflowStep('visualization', 'active');
    
    // Automatically identify uncertainty zones
    identifyUncertaintyZones(result);
    
    toast({
      title: "Inference Complete",
      description: "Ready for uncertainty analysis and active learning",
    });
  };

  const identifyUncertaintyZones = async (result: any) => {
    try {
      const response = await fetch('/api/v1/active-learning/uncertainty-zones/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          inference_id: result.inference_id,
          uncertainty_cog_path: result.uncertainty_cog,
          prospectivity_cog_path: result.prospectivity_cog
        })
      });

      if (response.ok) {
        updateWorkflowStep('labeling', 'active');
      }
    } catch (error) {
      console.error('Failed to identify uncertainty zones:', error);
    }
  };

  const handleLabelAdded = (label: any) => {
    // Could update UI to show label was added
    toast({
      title: "Label Added",
      description: `Added label at (${label.longitude.toFixed(4)}, ${label.latitude.toFixed(4)})`,
    });
  };

  const handleRetrainingStarted = (taskId: string) => {
    updateWorkflowStep('improvement', 'active');
    
    // Poll for retraining completion
    pollRetrainingStatus(taskId);
  };

  const pollRetrainingStatus = async (taskId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/active-learning/retraining/status/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'completed') {
            // Get full results
            const resultResponse = await fetch(`/api/v1/active-learning/retraining/result/${taskId}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            });

            if (resultResponse.ok) {
              const results = await resultResponse.json();
              setRetrainingResults(results);
              updateWorkflowStep('improvement', 'completed');
              
              toast({
                title: "Model Retraining Complete",
                description: `New model version ${results.new_model_version} is ready`,
              });
            }
          } else if (data.status === 'failed') {
            updateWorkflowStep('improvement', 'error');
            toast({
              title: "Retraining Failed",
              description: data.error || "Unknown error occurred",
              variant: "destructive",
            });
          } else if (data.status === 'running') {
            // Continue polling
            setTimeout(poll, 3000);
          }
        }
      } catch (error) {
        console.error('Failed to poll retraining status:', error);
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const getStepIcon = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'active':
        return <div className="h-4 w-4 rounded-full bg-blue-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStepBadgeVariant = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'active':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            AI Inference + Active Learning Workflow
          </CardTitle>
          <CardDescription>
            Complete workflow from inference to model improvement through active learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {workflowSteps.map((step, index) => (
              <div key={step.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {getStepIcon(step.status)}
                  <span className="font-medium text-sm">{step.title}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {step.description}
                </div>
                <Badge variant={getStepBadgeVariant(step.status)} className="text-xs">
                  {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                </Badge>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                    <div className="w-4 h-0.5 bg-gray-300"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inference" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Inference
          </TabsTrigger>
          <TabsTrigger value="visualization" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Visualization
          </TabsTrigger>
          <TabsTrigger value="labeling" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Active Learning
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inference">
          <AIInference
            onInferenceComplete={handleInferenceComplete}
            onLayerToggle={onLayerToggle}
            onOpacityChange={onOpacityChange}
          />
        </TabsContent>

        <TabsContent value="visualization">
          {inferenceResult ? (
            <UncertaintyVisualization
              inferenceResult={inferenceResult}
              onLayerToggle={onLayerToggle}
              onOpacityChange={onOpacityChange}
            />
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Run AI inference first to enable uncertainty visualization.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="labeling">
          <ActiveLearningLabeler
            inferenceResult={inferenceResult}
            onLabelAdded={handleLabelAdded}
            onRetrainingStarted={handleRetrainingStarted}
          />
        </TabsContent>

        <TabsContent value="results">
          {retrainingResults ? (
            <div className="space-y-6">
              {/* Model Improvement Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Model Improvement Results
                  </CardTitle>
                  <CardDescription>
                    Performance comparison between old and new model versions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium">New Model Version</div>
                      <div className="text-sm text-gray-600 font-mono">
                        {retrainingResults.new_model_version}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Training Samples</div>
                      <div className="text-sm text-gray-600">
                        {retrainingResults.training_samples} labels
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics Comparison */}
                  <div className="space-y-3">
                    <div className="font-medium">Performance Improvements</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(retrainingResults.improvement || {}).map(([metric, improvement]: [string, any]) => (
                        <div key={metric} className="text-center p-3 border rounded-lg">
                          <div className="text-sm font-medium capitalize">
                            {metric.replace('_', ' ')}
                          </div>
                          <div className={`text-lg font-bold ${
                            improvement > 0 ? 'text-green-600' : 
                            improvement < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {improvement > 0 ? '+' : ''}{(improvement * 100).toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-500">
                            {retrainingResults.metrics_before?.[metric]?.toFixed(3)} → {retrainingResults.metrics_after?.[metric]?.toFixed(3)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Steps */}
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="font-medium">Model Successfully Improved!</div>
                        <div className="text-sm">
                          The new model version is now available for inference. You can:
                        </div>
                        <ul className="text-sm list-disc list-inside space-y-1">
                          <li>Run new inference with the improved model</li>
                          <li>Compare results with previous predictions</li>
                          <li>Continue the active learning cycle with more labels</li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={() => setActiveTab('inference')}
                      className="flex items-center gap-2"
                    >
                      <Brain className="h-4 w-4" />
                      Run New Inference
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setActiveTab('labeling')}
                      className="flex items-center gap-2"
                    >
                      <Target className="h-4 w-4" />
                      Add More Labels
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="font-medium mb-3">Before Retraining</div>
                      <div className="space-y-2 text-sm">
                        {Object.entries(retrainingResults.metrics_before || {}).map(([metric, value]: [string, any]) => (
                          <div key={metric} className="flex justify-between">
                            <span className="capitalize">{metric.replace('_', ' ')}</span>
                            <span>{value.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium mb-3">After Retraining</div>
                      <div className="space-y-2 text-sm">
                        {Object.entries(retrainingResults.metrics_after || {}).map(([metric, value]: [string, any]) => (
                          <div key={metric} className="flex justify-between">
                            <span className="capitalize">{metric.replace('_', ' ')}</span>
                            <span className="font-medium">{value.toFixed(3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Complete the active learning workflow to see model improvement results here.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};