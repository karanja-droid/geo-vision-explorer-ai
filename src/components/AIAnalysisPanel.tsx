
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Zap,
  Target,
  BarChart3
} from "lucide-react";
import { useAIModels } from '@/hooks/useAIModels';
import { usePredictions } from '@/hooks/usePredictions';
import { useSites } from '@/hooks/useSites';

const AIAnalysisPanel = () => {
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const { models, getModelStats, getActiveModels } = useAIModels();
  const { predictions, getPredictionStats, getHighConfidencePredictions } = usePredictions();
  const { sites } = useSites();

  const runAnalysis = async () => {
    setAnalysisRunning(true);
    // Simulate analysis process
    setTimeout(() => setAnalysisRunning(false), 3000);
  };

  const modelStats = getModelStats();
  const predictionStats = getPredictionStats();
  const activeModels = getActiveModels();
  const highConfidencePredictions = getHighConfidencePredictions(80);

  // Transform real data for display
  const modelPerformance = activeModels.map(model => ({
    name: model.name,
    accuracy: model.performance_metrics?.accuracy || 0,
    status: model.is_active ? "Active" : "Training",
    lastTrained: new Date(model.updated_at).toLocaleDateString()
  }));

  const transformedPredictions = highConfidencePredictions.slice(0, 3).map(prediction => {
    const site = sites.find(s => s.id === prediction.site_id);
    return {
      location: site?.name || "Unknown Site",
      mineral: prediction.prediction_data?.mineral_type || "Unknown",
      confidence: prediction.confidence_score || 0,
      expectedYield: prediction.prediction_data?.expected_yield || "Medium",
      riskLevel: prediction.prediction_data?.risk_level || "Medium",
      recommendation: prediction.prediction_data?.recommendation || "Further Analysis"
    };
  });

  return (
    <div className="space-y-6">
      {/* AI Control Panel */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI Analysis Control Center
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage and monitor AI-powered mineral exploration models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={runAnalysis}
                disabled={analysisRunning}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {analysisRunning ? (
                  <>
                    <Activity className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                {modelStats.activeModels} Models Active
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Processing Status</p>
              <p className="text-lg font-bold text-green-400">
                {analysisRunning ? "Running" : "Ready"}
              </p>
            </div>
          </div>

          {analysisRunning && (
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-purple-300 font-medium">AI Analysis in Progress</span>
              </div>
              <Progress value={65} className="h-2 bg-slate-700" />
              <p className="text-xs text-slate-400 mt-2">
                Processing satellite imagery and geological data...
              </p>
            </div>
          )}

          <Tabs defaultValue="models" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-700">
              <TabsTrigger value="models">Model Performance</TabsTrigger>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="models" className="mt-4">
              <div className="space-y-3">
                {modelPerformance.map((model, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-200">{model.name}</p>
                      <p className="text-sm text-slate-400">Last trained: {model.lastTrained}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">{model.accuracy}%</p>
                        <p className="text-xs text-slate-500">Accuracy</p>
                      </div>
                      <Badge 
                        variant={model.status === "Active" ? "default" : "secondary"}
                        className={model.status === "Active" 
                          ? "bg-green-500/20 text-green-300 border-green-500/30"
                          : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                        }
                      >
                        {model.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="predictions" className="mt-4">
              <div className="space-y-3">
                {transformedPredictions.map((prediction, index) => (
                  <div key={index} className="p-4 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-slate-200">{prediction.location}</p>
                        <p className="text-sm text-slate-400">{prediction.mineral} Deposit</p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                        {prediction.confidence}% Confidence
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Expected Yield</p>
                        <p className="text-slate-300 font-medium">{prediction.expectedYield}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Risk Level</p>
                        <p className={`font-medium ${
                          prediction.riskLevel === "Low" ? "text-green-400" :
                          prediction.riskLevel === "Medium" ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {prediction.riskLevel}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Recommendation</p>
                        <p className="text-slate-300 font-medium">{prediction.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-300">Positive Trend Detected</p>
                    <p className="text-sm text-slate-300 mt-1">
                      Gold prediction accuracy has improved by 12% over the last month with enhanced satellite data integration.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-300">Attention Required</p>
                    <p className="text-sm text-slate-300 mt-1">
                      Copper anomaly model needs retraining. Recent geological survey data suggests pattern changes in target regions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Target className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-300">New Opportunity</p>
                    <p className="text-sm text-slate-300 mt-1">
                      AI models have identified 3 new high-potential lithium sites in the Atacama region with 90%+ confidence scores.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIAnalysisPanel;
