import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Brain, 
  MapPin, 
  Download,
  Eye,
  EyeOff,
  BarChart3,
  Info,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UncertaintyVisualization } from './UncertaintyVisualization';

interface AIInferenceProps {
  onInferenceComplete?: (result: any) => void;
  onLayerToggle?: (layer: string, visible: boolean) => void;
  onOpacityChange?: (layer: string, opacity: number) => void;
}

interface InferenceTask {
  task_id: string;
  status: string;
  progress?: any;
  result?: any;
  error?: string;
}

interface ModelInfo {
  version: string;
  created_at: string;
  description: string;
  metrics: {
    auc: number;
    precision: number;
    recall: number;
    f1: number;
  };
  status: string;
}

export const AIInference: React.FC<AIInferenceProps> = ({
  onInferenceComplete,
  onLayerToggle,
  onOpacityChange
}) => {
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<InferenceTask | null>(null);
  const [inferenceResult, setInferenceResult] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState('latest');
  const [aoiCoords, setAoiCoords] = useState('28.0,-26.0,28.1,-25.9');
  const [activeTab, setActiveTab] = useState('inference');
  const { toast } = useToast();

  useEffect(() => {
    loadAvailableModels();
  }, []);

  useEffect(() => {
    if (currentTask && currentTask.status === 'running') {
      const interval = setInterval(() => {
        pollTaskStatus(currentTask.task_id);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentTask]);

  const loadAvailableModels = async () => {
    try {
      const response = await fetch('/api/v1/ai/models/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models);
        setSelectedModel(data.default_version);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const runInference = async () => {
    setLoading(true);
    try {
      // Parse AOI coordinates to create GeoJSON
      const coords = aoiCoords.split(',').map(Number);
      if (coords.length !== 4) {
        throw new Error('Invalid AOI coordinates format');
      }

      const [minLon, minLat, maxLon, maxLat] = coords;
      const aoiGeoJSON = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat]
          ]]
        },
        properties: {},
        bbox: coords
      };

      const response = await fetch('/api/v1/ai/inference/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          aoi: aoiGeoJSON,
          model_version: selectedModel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start inference');
      }

      const data = await response.json();
      setCurrentTask({
        task_id: data.task_id,
        status: 'running'
      });

      toast({
        title: "AI Inference Started",
        description: `Using model ${selectedModel}. Estimated completion: ${data.estimated_completion_minutes} minutes`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start inference",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/v1/ai/inference/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentTask(data);

        if (data.status === 'completed') {
          // Get the full result
          const resultResponse = await fetch(`/api/v1/ai/inference/result/${taskId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          });

          if (resultResponse.ok) {
            const result = await resultResponse.json();
            setInferenceResult(result);
            setActiveTab('results');
            
            if (onInferenceComplete) {
              onInferenceComplete(result);
            }

            toast({
              title: "Inference Complete",
              description: `Generated prospectivity and uncertainty maps for inference ${result.inference_id}`,
            });
          }
        } else if (data.status === 'failed') {
          toast({
            title: "Inference Failed",
            description: data.error || "Unknown error occurred",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Failed to poll task status:', error);
    }
  };

  const downloadCOG = async (type: 'prospectivity' | 'uncertainty') => {
    if (!inferenceResult) return;

    try {
      const cogPath = type === 'prospectivity' 
        ? inferenceResult.prospectivity_cog 
        : inferenceResult.uncertainty_cog;

      // In a real implementation, this would handle S3 signed URLs
      toast({
        title: "Download Started",
        description: `Downloading ${type} COG file`,
      });

    } catch (error) {
      toast({
        title: "Download Failed",
        description: `Failed to download ${type} file`,
        variant: "destructive",
      });
    }
  };

  const getProgressPercentage = () => {
    if (!currentTask?.progress) return 0;
    const { current, total } = currentTask.progress;
    return total > 0 ? (current / total) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Prospectivity Inference
          </CardTitle>
          <CardDescription>
            Generate prospectivity and uncertainty maps using machine learning models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inference">Run Inference</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="visualization">Visualization</TabsTrigger>
            </TabsList>

            <TabsContent value="inference" className="space-y-4">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label htmlFor="model">Model Version</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map(model => (
                      <SelectItem key={model.version} value={model.version}>
                        <div className="flex items-center justify-between w-full">
                          <span>{model.version}</span>
                          <Badge variant={model.status === 'active' ? 'default' : 'outline'}>
                            {model.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Model Info */}
              {selectedModel && availableModels.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  {(() => {
                    const model = availableModels.find(m => m.version === selectedModel);
                    if (!model) return null;
                    
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-medium">Model Performance</Label>
                          <Badge variant="outline">
                            AUC: {model.metrics.auc.toFixed(3)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>Precision: {model.metrics.precision.toFixed(3)}</div>
                          <div>Recall: {model.metrics.recall.toFixed(3)}</div>
                          <div>F1: {model.metrics.f1.toFixed(3)}</div>
                        </div>
                        <div className="text-sm text-gray-600">
                          {model.description}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* AOI Input */}
              <div className="space-y-2">
                <Label htmlFor="aoi">Area of Interest (min_lon,min_lat,max_lon,max_lat)</Label>
                <Input
                  id="aoi"
                  value={aoiCoords}
                  onChange={(e) => setAoiCoords(e.target.value)}
                  placeholder="28.0,-26.0,28.1,-25.9"
                />
              </div>

              {/* Run Button */}
              <Button 
                onClick={runInference} 
                disabled={loading || (currentTask?.status === 'running')}
                className="w-full"
              >
                {loading || (currentTask?.status === 'running') ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="mr-2 h-4 w-4" />
                )}
                Run AI Inference
              </Button>

              {/* Task Progress */}
              {currentTask && currentTask.status === 'running' && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Status: {currentTask.progress?.status || 'Processing...'}</span>
                        <span>{Math.round(getProgressPercentage())}%</span>
                      </div>
                      <Progress value={getProgressPercentage()} className="w-full" />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Task Completed */}
              {currentTask && currentTask.status === 'completed' && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Inference completed successfully! Check the Results tab to view outputs.
                  </AlertDescription>
                </Alert>
              )}

              {/* Task Failed */}
              {currentTask && currentTask.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Inference failed: {currentTask.error || 'Unknown error'}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {inferenceResult ? (
                <div className="space-y-4">
                  {/* Result Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Inference Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span>Inference ID:</span>
                          <span className="font-mono text-sm">{inferenceResult.inference_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Model Version:</span>
                          <span>{inferenceResult.metadata?.model_version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant="default">{inferenceResult.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="space-y-1">
                          <div className="font-medium">Prospectivity</div>
                          <div className="text-sm text-gray-600">
                            Range: {inferenceResult.statistics?.prospectivity?.min?.toFixed(3)} - {inferenceResult.statistics?.prospectivity?.max?.toFixed(3)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="font-medium">Uncertainty</div>
                          <div className="text-sm text-gray-600">
                            Range: {inferenceResult.statistics?.uncertainty?.min?.toFixed(3)} - {inferenceResult.statistics?.uncertainty?.max?.toFixed(3)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Download Options */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Download Results</CardTitle>
                      <CardDescription>
                        Download Cloud-Optimized GeoTIFF files for use in GIS software
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button 
                          onClick={() => downloadCOG('prospectivity')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Prospectivity COG
                        </Button>
                        <Button 
                          onClick={() => downloadCOG('uncertainty')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Uncertainty COG
                        </Button>
                      </div>
                      
                      <div className="text-sm text-gray-600">
                        <div className="font-medium mb-1">File Information:</div>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Format: Cloud-Optimized GeoTIFF (COG)</li>
                          <li>CRS: EPSG:4326 (WGS84)</li>
                          <li>Data Type: Float32</li>
                          <li>Value Range: 0.0 - 1.0</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  {/* STAC Information */}
                  {inferenceResult.stac_item && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">STAC Metadata</CardTitle>
                        <CardDescription>
                          SpatioTemporal Asset Catalog information for data discovery
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>STAC Version:</span>
                            <span>{inferenceResult.stac_item.stac_version}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Assets:</span>
                            <span>{Object.keys(inferenceResult.stac_item.assets || {}).length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Geometry Type:</span>
                            <span>{inferenceResult.stac_item.geometry?.type}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No inference results available. Run an inference first.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="visualization" className="space-y-4">
              <UncertaintyVisualization
                inferenceResult={inferenceResult}
                onLayerToggle={onLayerToggle}
                onOpacityChange={onOpacityChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};