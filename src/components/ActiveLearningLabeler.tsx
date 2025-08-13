import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Target, 
  Brain,
  MapPin,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Eye,
  Crosshair,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActiveLearningLabelerProps {
  inferenceResult?: any;
  onLabelAdded?: (label: any) => void;
  onRetrainingStarted?: (taskId: string) => void;
}

interface LabelingSuggestion {
  id: string;
  longitude: number;
  latitude: number;
  uncertainty_value: number;
  prediction_value: number;
  priority_score: number;
  is_labeled: boolean;
}

interface TrainingLabel {
  id: string;
  longitude: number;
  latitude: number;
  label_value: number;
  confidence: number;
  source: string;
  created_at: string;
  uncertainty_value?: number;
  prediction_value?: number;
}

interface RetrainingEligibility {
  eligible: boolean;
  total_labels: number;
  recent_labels: number;
  positive_labels: number;
  negative_labels: number;
  min_required: number;
  recommendation: string;
}

export const ActiveLearningLabeler: React.FC<ActiveLearningLabelerProps> = ({
  inferenceResult,
  onLabelAdded,
  onRetrainingStarted
}) => {
  const [activeTab, setActiveTab] = useState('labeling');
  const [labelingMode, setLabelingMode] = useState<'manual' | 'suggestions'>('suggestions');
  const [suggestions, setSuggestions] = useState<LabelingSuggestion[]>([]);
  const [labels, setLabels] = useState<TrainingLabel[]>([]);
  const [eligibility, setEligibility] = useState<RetrainingEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [retrainingTask, setRetrainingTask] = useState<any>(null);
  
  // Manual labeling state
  const [manualCoords, setManualCoords] = useState('');
  const [labelValue, setLabelValue] = useState([0.5]);
  const [confidence, setConfidence] = useState([1.0]);
  
  const { toast } = useToast();

  useEffect(() => {
    if (inferenceResult) {
      loadSuggestions();
      loadLabels();
      checkEligibility();
    }
  }, [inferenceResult]);

  useEffect(() => {
    if (retrainingTask && retrainingTask.status === 'running') {
      const interval = setInterval(() => {
        pollRetrainingStatus(retrainingTask.task_id);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [retrainingTask]);

  const loadSuggestions = async () => {
    if (!inferenceResult?.inference_id) return;

    try {
      const response = await fetch('/api/v1/active-learning/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          inference_id: inferenceResult.inference_id,
          limit: 20,
          exclude_labeled: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const loadLabels = async () => {
    if (!inferenceResult?.inference_id) return;

    try {
      const response = await fetch(
        `/api/v1/active-learning/labels?inference_id=${inferenceResult.inference_id}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLabels(data);
      }
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const checkEligibility = async () => {
    try {
      const response = await fetch('/api/v1/active-learning/retraining/eligibility', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEligibility(data);
      }
    } catch (error) {
      console.error('Failed to check eligibility:', error);
    }
  };

  const addLabel = async (longitude: number, latitude: number, value: number, conf: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/active-learning/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          longitude,
          latitude,
          label_value: value,
          confidence: conf,
          source: 'user',
          inference_id: inferenceResult?.inference_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add label');
      }

      const newLabel = await response.json();
      setLabels(prev => [newLabel, ...prev]);
      
      if (onLabelAdded) {
        onLabelAdded(newLabel);
      }

      // Refresh suggestions and eligibility
      await loadSuggestions();
      await checkEligibility();

      toast({
        title: "Label Added",
        description: `Added label at (${longitude.toFixed(4)}, ${latitude.toFixed(4)}) with value ${value.toFixed(2)}`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add label",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionLabel = async (suggestion: LabelingSuggestion, value: number) => {
    await addLabel(suggestion.longitude, suggestion.latitude, value, 0.8);
  };

  const handleManualLabel = async () => {
    try {
      const coords = manualCoords.split(',').map(Number);
      if (coords.length !== 2) {
        throw new Error('Invalid coordinates format');
      }

      const [longitude, latitude] = coords;
      await addLabel(longitude, latitude, labelValue[0], confidence[0]);
      
      // Clear form
      setManualCoords('');
      setLabelValue([0.5]);
      setConfidence([1.0]);

    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid coordinates format. Use: longitude,latitude",
        variant: "destructive",
      });
    }
  };

  const startRetraining = async () => {
    setRetraining(true);
    try {
      const response = await fetch('/api/v1/active-learning/retraining/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          base_model_version: 'latest'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start retraining');
      }

      const data = await response.json();
      setRetrainingTask({
        task_id: data.task_id,
        status: 'running'
      });

      if (onRetrainingStarted) {
        onRetrainingStarted(data.task_id);
      }

      toast({
        title: "Retraining Started",
        description: `Model retraining initiated with ${eligibility?.total_labels} labels`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start model retraining",
        variant: "destructive",
      });
      setRetraining(false);
    }
  };

  const pollRetrainingStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/v1/active-learning/retraining/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRetrainingTask(data);

        if (data.status === 'completed') {
          setRetraining(false);
          toast({
            title: "Retraining Complete",
            description: "New model version created successfully",
          });
          setActiveTab('results');
        } else if (data.status === 'failed') {
          setRetraining(false);
          toast({
            title: "Retraining Failed",
            description: data.error || "Unknown error occurred",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Failed to poll retraining status:', error);
    }
  };

  const getProgressPercentage = () => {
    if (!retrainingTask?.progress) return 0;
    const { current, total } = retrainingTask.progress;
    return total > 0 ? (current / total) * 100 : 0;
  };

  if (!inferenceResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Active Learning Labeler
          </CardTitle>
          <CardDescription>
            Provide training labels to improve AI model performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Run AI inference first to enable active learning labeling.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Active Learning Labeler
          </CardTitle>
          <CardDescription>
            Improve model performance by labeling high-uncertainty areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="labeling">Labeling</TabsTrigger>
              <TabsTrigger value="retraining">Retraining</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="labeling" className="space-y-4">
              {/* Labeling Mode Selection */}
              <div className="flex gap-2">
                <Button
                  variant={labelingMode === 'suggestions' ? 'default' : 'outline'}
                  onClick={() => setLabelingMode('suggestions')}
                  className="flex items-center gap-2"
                >
                  <Crosshair className="h-4 w-4" />
                  Smart Suggestions
                </Button>
                <Button
                  variant={labelingMode === 'manual' ? 'default' : 'outline'}
                  onClick={() => setLabelingMode('manual')}
                  className="flex items-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Manual Entry
                </Button>
              </div>

              {labelingMode === 'suggestions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">High-Uncertainty Suggestions</Label>
                    <Badge variant="outline">
                      {suggestions.length} available
                    </Badge>
                  </div>

                  {suggestions.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {suggestions.slice(0, 10).map((suggestion, index) => (
                        <div key={suggestion.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">
                                Location #{index + 1}
                              </div>
                              <div className="text-sm text-gray-600">
                                {suggestion.longitude.toFixed(4)}, {suggestion.latitude.toFixed(4)}
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <Badge variant="destructive">
                                Uncertainty: {(suggestion.uncertainty_value * 100).toFixed(1)}%
                              </Badge>
                              <div className="text-sm text-gray-600">
                                Prediction: {(suggestion.prediction_value * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuggestionLabel(suggestion, 0.0)}
                              disabled={loading}
                              className="flex-1"
                            >
                              No Mineralization (0%)
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSuggestionLabel(suggestion, 0.5)}
                              disabled={loading}
                              className="flex-1"
                            >
                              Moderate (50%)
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSuggestionLabel(suggestion, 1.0)}
                              disabled={loading}
                              className="flex-1"
                            >
                              High Potential (100%)
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <Eye className="h-4 w-4" />
                      <AlertDescription>
                        No high-uncertainty suggestions available. All suggested areas may have been labeled.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {labelingMode === 'manual' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="coords">Coordinates (longitude,latitude)</Label>
                    <Input
                      id="coords"
                      value={manualCoords}
                      onChange={(e) => setManualCoords(e.target.value)}
                      placeholder="28.0500,-25.9500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Prospectivity Label</Label>
                      <span className="text-sm text-gray-500">
                        {(labelValue[0] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={labelValue}
                      onValueChange={setLabelValue}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>No Potential</span>
                      <span>High Potential</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Confidence</Label>
                      <span className="text-sm text-gray-500">
                        {(confidence[0] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={confidence}
                      onValueChange={setConfidence}
                      max={1}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <Button
                    onClick={handleManualLabel}
                    disabled={loading || !manualCoords}
                    className="w-full"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Label
                  </Button>
                </div>
              )}

              {/* Current Labels Summary */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="font-medium">Current Labels</Label>
                  <Badge variant="outline">
                    {labels.length} total
                  </Badge>
                </div>
                
                {labels.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Positive Labels</div>
                      <div className="text-gray-600">
                        {labels.filter(l => l.label_value >= 0.5).length}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Negative Labels</div>
                      <div className="text-gray-600">
                        {labels.filter(l => l.label_value < 0.5).length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="retraining" className="space-y-4">
              {/* Retraining Eligibility */}
              {eligibility && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Retraining Eligibility</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      {eligibility.eligible ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="font-medium">
                        {eligibility.eligible ? 'Ready for Retraining' : 'Not Ready'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Total Labels</div>
                        <div className="text-gray-600">
                          {eligibility.total_labels} / {eligibility.min_required} required
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Recent Labels</div>
                        <div className="text-gray-600">
                          {eligibility.recent_labels} (last 30 days)
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Positive Labels</div>
                        <div className="text-gray-600">
                          {eligibility.positive_labels}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Negative Labels</div>
                        <div className="text-gray-600">
                          {eligibility.negative_labels}
                        </div>
                      </div>
                    </div>

                    <Alert>
                      <AlertDescription>
                        {eligibility.recommendation}
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={startRetraining}
                      disabled={!eligibility.eligible || retraining}
                      className="w-full"
                    >
                      {retraining ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="mr-2 h-4 w-4" />
                      )}
                      Start Model Retraining
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Retraining Progress */}
              {retrainingTask && retraining && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Status: {retrainingTask.progress?.status || 'Processing...'}</span>
                        <span>{Math.round(getProgressPercentage())}%</span>
                      </div>
                      <Progress value={getProgressPercentage()} className="w-full" />
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              {retrainingTask && retrainingTask.status === 'completed' && retrainingTask.result ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Retraining Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium">New Model Version</div>
                        <div className="text-sm text-gray-600 font-mono">
                          {retrainingTask.result.new_model_version}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Training Samples</div>
                        <div className="text-sm text-gray-600">
                          {retrainingTask.result.training_samples}
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-3">
                      <Label className="font-medium">Performance Improvement</Label>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {Object.entries(retrainingTask.result.improvement || {}).map(([metric, improvement]: [string, any]) => (
                          <div key={metric} className="flex justify-between">
                            <span className="capitalize">{metric.replace('_', ' ')}</span>
                            <span className={improvement > 0 ? 'text-green-600' : improvement < 0 ? 'text-red-600' : 'text-gray-600'}>
                              {improvement > 0 ? '+' : ''}{(improvement * 100).toFixed(2)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Model retraining completed successfully! The new model version is now available for inference.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No retraining results available. Complete a retraining task to see results here.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};