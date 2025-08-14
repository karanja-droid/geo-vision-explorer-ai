/**
 * Predictive Analytics Dashboard
 * 
 * Provides ML-powered forecasting and predictive insights
 * including performance predictions, resource planning, and risk assessment
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Brain, 
  AlertTriangle, 
  Calendar,
  Target,
  Activity,
  Zap,
  Clock,
  DollarSign,
  Users
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';

interface PredictiveData {
  timestamp: string;
  project_id: string;
  prediction_horizon: string;
  drilling_forecast: {
    predicted_meters: number;
    predicted_holes: number;
    completion_probability: number;
    risk_factors: string[];
    confidence: number;
  };
  resource_forecast: {
    crew_hours: number;
    equipment_hours: number;
    material_costs: number;
    total_cost_estimate: number;
    confidence: number;
  };
  quality_forecast: {
    predicted_qc_rate: number;
    risk_areas: string[];
    improvement_opportunities: string[];
    confidence: number;
  };
  timeline_forecast: {
    estimated_completion: string;
    critical_path_items: string[];
    delay_probability: number;
    confidence: number;
  };
  risk_forecast: {
    overall_risk_score: number;
    high_risk_areas: string[];
    mitigation_strategies: string[];
    confidence: number;
  };
  anomalies: Array<{
    type: string;
    description: string;
    severity: string;
    probability: number;
    detected_at: string;
  }>;
}

const PredictiveAnalytics: React.FC = () => {
  const [predictiveData, setPredictiveData] = useState<PredictiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [predictionHorizon, setPredictionHorizon] = useState('90d');
  const [selectedProject, setSelectedProject] = useState('project_001');

  useEffect(() => {
    fetchPredictiveData();
  }, [predictionHorizon, selectedProject]);

  const fetchPredictiveData = async () => {
    setLoading(true);
    try {
      // Mock predictive data
      const mockData: PredictiveData = {
        timestamp: new Date().toISOString(),
        project_id: selectedProject,
        prediction_horizon: predictionHorizon,
        drilling_forecast: {
          predicted_meters: 4500,
          predicted_holes: 30,
          completion_probability: 87.5,
          risk_factors: ['weather', 'equipment_maintenance'],
          confidence: 82.3
        },
        resource_forecast: {
          crew_hours: 2400,
          equipment_hours: 1800,
          material_costs: 125000,
          total_cost_estimate: 450000,
          confidence: 78.9
        },
        quality_forecast: {
          predicted_qc_rate: 94.2,
          risk_areas: ['sample_contamination', 'standard_accuracy'],
          improvement_opportunities: ['automated_qc', 'enhanced_protocols'],
          confidence: 85.1
        },
        timeline_forecast: {
          estimated_completion: '2025-03-15',
          critical_path_items: ['drilling_phase_2', 'laboratory_analysis', 'report_preparation'],
          delay_probability: 23.5,
          confidence: 79.8
        },
        risk_forecast: {
          overall_risk_score: 35.2,
          high_risk_areas: ['equipment_failure', 'weather_delays'],
          mitigation_strategies: ['preventive_maintenance', 'weather_monitoring'],
          confidence: 88.7
        },
        anomalies: [
          {
            type: 'equipment',
            description: 'Drill rig showing unusual vibration patterns',
            severity: 'medium',
            probability: 0.72,
            detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            type: 'quality',
            description: 'QC standards showing drift in accuracy',
            severity: 'low',
            probability: 0.45,
            detected_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
          }
        ]
      };

      setPredictiveData(mockData);
    } catch (error) {
      console.error('Failed to fetch predictive data:', error);
    } finally {
      setLoading(false);
    }
  };  const
 getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 70) return 'text-red-600';
    if (riskScore >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Mock forecast chart data
  const drillingForecastData = [
    { date: '2025-01-15', actual: 150, predicted: 155, confidence_upper: 165, confidence_lower: 145 },
    { date: '2025-01-20', actual: null, predicted: 160, confidence_upper: 175, confidence_lower: 145 },
    { date: '2025-01-25', actual: null, predicted: 165, confidence_upper: 180, confidence_lower: 150 },
    { date: '2025-01-30', actual: null, predicted: 170, confidence_upper: 185, confidence_lower: 155 },
    { date: '2025-02-05', actual: null, predicted: 175, confidence_upper: 190, confidence_lower: 160 },
  ];

  const costForecastData = [
    { month: 'Jan', actual: 120000, predicted: 125000, budget: 130000 },
    { month: 'Feb', actual: null, predicted: 135000, budget: 140000 },
    { month: 'Mar', actual: null, predicted: 145000, budget: 150000 },
    { month: 'Apr', actual: null, predicted: 155000, budget: 160000 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!predictiveData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Predictive Data Available</h3>
          <p className="text-gray-600">Unable to load predictive analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-purple-600" />
            Predictive Analytics
          </h1>
          <p className="text-gray-600">
            AI-powered forecasting and predictive insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project_001">Witwatersrand Gold Project</SelectItem>
              <SelectItem value="project_002">Bushveld Platinum Mine</SelectItem>
              <SelectItem value="project_003">Kalahari Copper Prospect</SelectItem>
            </SelectContent>
          </Select>
          <Select value={predictionHorizon} onValueChange={setPredictionHorizon}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="60d">60 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="180d">6 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Anomaly Alerts */}
      {predictiveData.anomalies.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Anomalies Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {predictiveData.anomalies.map((anomaly, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <p className="font-medium">{anomaly.description}</p>
                      <p className="text-sm text-gray-600">
                        Probability: {(anomaly.probability * 100).toFixed(1)}% • 
                        Detected: {new Date(anomaly.detected_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Investigate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Prediction Tabs */}
      <Tabs defaultValue="drilling" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="drilling">Drilling</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        {/* Drilling Forecast */}
        <TabsContent value="drilling" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predicted Meters</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{predictiveData.drilling_forecast.predicted_meters.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">Confidence:</span>
                  <span className={`text-sm font-medium ${getConfidenceColor(predictiveData.drilling_forecast.confidence)}`}>
                    {predictiveData.drilling_forecast.confidence.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predicted Holes</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{predictiveData.drilling_forecast.predicted_holes}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">Completion Probability:</span>
                  <span className="text-sm font-medium text-green-600">
                    {predictiveData.drilling_forecast.completion_probability.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Risk Factors</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {predictiveData.drilling_forecast.risk_factors.map((factor, index) => (
                    <Badge key={index} variant="outline" className="mr-1">
                      {factor.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Drilling Performance Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={drillingForecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area dataKey="confidence_upper" stroke="none" fill="#e5e7eb" fillOpacity={0.3} />
                  <Area dataKey="confidence_lower" stroke="none" fill="#ffffff" fillOpacity={1} />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2} name="Actual" />
                  <Line type="monotone" dataKey="predicted" stroke="#dc2626" strokeDasharray="5 5" strokeWidth={2} name="Predicted" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resource Forecast */}
        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Crew Hours</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{predictiveData.resource_forecast.crew_hours.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Estimated crew hours needed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Equipment Hours</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{predictiveData.resource_forecast.equipment_hours.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Estimated equipment hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Material Costs</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${predictiveData.resource_forecast.material_costs.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Estimated material costs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${predictiveData.resource_forecast.total_cost_estimate.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">Confidence:</span>
                  <span className={`text-sm font-medium ${getConfidenceColor(predictiveData.resource_forecast.confidence)}`}>
                    {predictiveData.resource_forecast.confidence.toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Forecast vs Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costForecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="budget" fill="#e5e7eb" name="Budget" />
                  <Bar dataKey="predicted" fill="#2563eb" name="Predicted" />
                  <Bar dataKey="actual" fill="#16a34a" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Forecast */}
        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Quality Prediction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {predictiveData.quality_forecast.predicted_qc_rate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-gray-600">Predicted QC Pass Rate</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(predictiveData.quality_forecast.confidence)}`}>
                      {predictiveData.quality_forecast.confidence.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress value={predictiveData.quality_forecast.predicted_qc_rate} className="mb-4" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Areas & Opportunities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Risk Areas</h4>
                    <div className="space-y-1">
                      {predictiveData.quality_forecast.risk_areas.map((area, index) => (
                        <Badge key={index} className="bg-red-100 text-red-800 mr-1">
                          {area.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Improvement Opportunities</h4>
                    <div className="space-y-1">
                      {predictiveData.quality_forecast.improvement_opportunities.map((opportunity, index) => (
                        <Badge key={index} className="bg-green-100 text-green-800 mr-1">
                          {opportunity.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline Forecast */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Project Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Estimated Completion</label>
                    <div className="text-2xl font-bold text-blue-600">
                      {new Date(predictiveData.timeline_forecast.estimated_completion).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Delay Probability</label>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-yellow-600">
                        {predictiveData.timeline_forecast.delay_probability.toFixed(1)}%
                      </div>
                      <Progress value={predictiveData.timeline_forecast.delay_probability} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Confidence</label>
                    <div className={`text-lg font-bold ${getConfidenceColor(predictiveData.timeline_forecast.confidence)}`}>
                      {predictiveData.timeline_forecast.confidence.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Critical Path Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {predictiveData.timeline_forecast.critical_path_items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">{item.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Forecast */}
        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Overall Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className={`text-4xl font-bold mb-2 ${getRiskColor(predictiveData.risk_forecast.overall_risk_score)}`}>
                    {predictiveData.risk_forecast.overall_risk_score.toFixed(1)}
                  </div>
                  <p className="text-sm text-gray-600">Risk Score (0-100)</p>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(predictiveData.risk_forecast.confidence)}`}>
                      {predictiveData.risk_forecast.confidence.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress value={predictiveData.risk_forecast.overall_risk_score} className="mb-4" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">High Risk Areas</h4>
                    <div className="space-y-1">
                      {predictiveData.risk_forecast.high_risk_areas.map((area, index) => (
                        <Badge key={index} className="bg-red-100 text-red-800 mr-1">
                          {area.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">Mitigation Strategies</h4>
                    <div className="space-y-1">
                      {predictiveData.risk_forecast.mitigation_strategies.map((strategy, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                          <Zap className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">{strategy.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PredictiveAnalytics;