/**
 * Operational Intelligence Dashboard
 * 
 * Provides real-time operational metrics and insights for project management
 * including drilling performance, sampling operations, quality control, and resource utilization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Drill, 
  TestTube, 
  Shield, 
  Users, 
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  MapPin,
  Gauge
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts';

interface OperationalData {
  timestamp: string;
  project_id: string;
  granularity: string;
  drilling: {
    total_holes: number;
    total_meters: number;
    average_depth: number;
    drilling_rate: number;
    completion_rate: number;
    efficiency_score: number;
  };
  sampling: {
    samples_collected: number;
    samples_analyzed: number;
    pending_analysis: number;
    average_turnaround: number;
    quality_score: number;
  };
  quality: {
    qc_pass_rate: number;
    standard_accuracy: number;
    blank_contamination: number;
    duplicate_precision: number;
    overall_quality_score: number;
  };
  productivity: {
    meters_per_day: number;
    samples_per_day: number;
    equipment_uptime: number;
    crew_efficiency: number;
    overall_productivity: number;
  };
  resources: {
    active_equipment: number;
    crew_count: number;
    utilization_rate: number;
    maintenance_scheduled: number;
  };
  predictions: {
    predicted_completion: string;
    risk_factors: string[];
    confidence_score: number;
  };
  recommendations: string[];
}

interface RealTimeMetrics {
  active_drill_holes: number;
  crews_on_site: number;
  equipment_active: number;
  current_depth: number;
  status: string;
}

const OperationalIntelligence: React.FC = () => {
  const [operationalData, setOperationalData] = useState<OperationalData | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState('daily');
  const [selectedProject, setSelectedProject] = useState('project_001');

  useEffect(() => {
    fetchOperationalData();
    fetchRealTimeMetrics();
    
    // Set up real-time updates
    const interval = setInterval(fetchRealTimeMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [granularity, selectedProject]);

  const fetchOperationalData = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockData: OperationalData = {
        timestamp: new Date().toISOString(),
        project_id: selectedProject,
        granularity: granularity,
        drilling: {
          total_holes: 45,
          total_meters: 6750,
          average_depth: 150,
          drilling_rate: 125.5,
          completion_rate: 85.2,
          efficiency_score: 88.7
        },
        sampling: {
          samples_collected: 1250,
          samples_analyzed: 1180,
          pending_analysis: 70,
          average_turnaround: 3.2,
          quality_score: 94.5
        },
        quality: {
          qc_pass_rate: 96.8,
          standard_accuracy: 98.2,
          blank_contamination: 0.5,
          duplicate_precision: 95.1,
          overall_quality_score: 97.2
        },
        productivity: {
          meters_per_day: 145.2,
          samples_per_day: 42.3,
          equipment_uptime: 92.5,
          crew_efficiency: 88.9,
          overall_productivity: 89.7
        },
        resources: {
          active_equipment: 8,
          crew_count: 24,
          utilization_rate: 87.5,
          maintenance_scheduled: 2
        },
        predictions: {
          predicted_completion: '2025-03-15',
          risk_factors: ['weather', 'equipment_maintenance'],
          confidence_score: 82.3
        },
        recommendations: [
          'Consider equipment maintenance to improve drilling efficiency',
          'Optimize crew scheduling for better productivity',
          'Review QC procedures to maintain high quality standards'
        ]
      };

      setOperationalData(mockData);
    } catch (error) {
      console.error('Failed to fetch operational data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRealTimeMetrics = async () => {
    try {
      // Mock real-time data
      const mockRealTime: RealTimeMetrics = {
        active_drill_holes: 3,
        crews_on_site: 2,
        equipment_active: 5,
        current_depth: 1250.5,
        status: 'active'
      };

      setRealTimeMetrics(mockRealTime);
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'text-green-600';
    if (efficiency >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  // Mock chart data
  const drillingTrendData = [
    { date: '2025-01-07', meters: 120, target: 150 },
    { date: '2025-01-08', meters: 135, target: 150 },
    { date: '2025-01-09', meters: 145, target: 150 },
    { date: '2025-01-10', meters: 155, target: 150 },
    { date: '2025-01-11', meters: 140, target: 150 },
    { date: '2025-01-12', meters: 160, target: 150 },
    { date: '2025-01-13', meters: 150, target: 150 },
  ];

  const qualityTrendData = [
    { date: '2025-01-07', qc_pass: 95.2, accuracy: 97.8 },
    { date: '2025-01-08', qc_pass: 96.1, accuracy: 98.1 },
    { date: '2025-01-09', qc_pass: 94.8, accuracy: 97.9 },
    { date: '2025-01-10', qc_pass: 97.2, accuracy: 98.5 },
    { date: '2025-01-11', qc_pass: 96.8, accuracy: 98.2 },
    { date: '2025-01-12', qc_pass: 95.9, accuracy: 98.0 },
    { date: '2025-01-13', qc_pass: 96.8, accuracy: 98.2 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!operationalData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Data Available</h3>
          <p className="text-gray-600">Unable to load operational data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Operational Intelligence</h1>
          <p className="text-gray-600">
            Real-time operational metrics and insights
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
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchRealTimeMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Status */}
      {realTimeMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Operations Status
              <Badge className={realTimeMetrics.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                {realTimeMetrics.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{realTimeMetrics.active_drill_holes}</div>
                <div className="text-sm text-gray-600">Active Drill Holes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{realTimeMetrics.crews_on_site}</div>
                <div className="text-sm text-gray-600">Crews On Site</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{realTimeMetrics.equipment_active}</div>
                <div className="text-sm text-gray-600">Equipment Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatNumber(realTimeMetrics.current_depth, 1)}m</div>
                <div className="text-sm text-gray-600">Current Depth</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Metrics Tabs */}
      <Tabs defaultValue="drilling" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drilling">Drilling</TabsTrigger>
          <TabsTrigger value="sampling">Sampling</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
        </TabsList>

        {/* Drilling Tab */}
        <TabsContent value="drilling" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Holes</CardTitle>
                <Drill className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operationalData.drilling.total_holes}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(operationalData.drilling.average_depth)}m avg depth
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Meters</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operationalData.drilling.total_meters.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(operationalData.drilling.drilling_rate)}m/day rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(operationalData.drilling.completion_rate)}%</div>
                <Progress value={operationalData.drilling.completion_rate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Efficiency Score</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getEfficiencyColor(operationalData.drilling.efficiency_score)}`}>
                  {formatNumber(operationalData.drilling.efficiency_score)}%
                </div>
                <Progress value={operationalData.drilling.efficiency_score} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Drilling Performance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={drillingTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="meters" stroke="#2563eb" strokeWidth={2} name="Actual Meters" />
                  <Line type="monotone" dataKey="target" stroke="#dc2626" strokeDasharray="5 5" name="Target" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sampling Tab */}
        <TabsContent value="sampling" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Samples Collected</CardTitle>
                <TestTube className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operationalData.sampling.samples_collected.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Total samples collected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Samples Analyzed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{operationalData.sampling.samples_analyzed.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {operationalData.sampling.pending_analysis} pending analysis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turnaround Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(operationalData.sampling.average_turnaround)} days</div>
                <p className="text-xs text-muted-foreground">
                  Average processing time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(operationalData.sampling.quality_score)}%</div>
                <Progress value={operationalData.sampling.quality_score} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sample Processing Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Collected</span>
                    <span className="text-lg font-bold">{operationalData.sampling.samples_collected}</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Analyzed</span>
                    <span className="text-lg font-bold">{operationalData.sampling.samples_analyzed}</span>
                  </div>
                  <Progress value={(operationalData.sampling.samples_analyzed / operationalData.sampling.samples_collected) * 100} className="h-2" />
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Pending</span>
                    <span className="text-lg font-bold text-yellow-600">{operationalData.sampling.pending_analysis}</span>
                  </div>
                  <Progress value={(operationalData.sampling.pending_analysis / operationalData.sampling.samples_collected) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Efficiency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {formatNumber((operationalData.sampling.samples_analyzed / operationalData.sampling.samples_collected) * 100)}%
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Completion Rate</p>
                  <div className="text-2xl font-bold text-green-600">
                    {formatNumber(operationalData.sampling.average_turnaround)} days
                  </div>
                  <p className="text-sm text-gray-600">Average Turnaround</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">QC Pass Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(operationalData.quality.qc_pass_rate)}%</div>
                <Progress value={operationalData.quality.qc_pass_rate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Standard Accuracy</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatNumber(operationalData.quality.standard_accuracy)}%</div>
                <Progress value={operationalData.quality.standard_accuracy} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blank Contamination</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(operationalData.quality.blank_contamination)}%</div>
                <p className="text-xs text-muted-foreground">
                  Low contamination rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Quality</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(operationalData.quality.overall_quality_score)}%</div>
                <Progress value={operationalData.quality.overall_quality_score} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quality Control Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={qualityTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[90, 100]} />
                  <Tooltip />
                  <Area type="monotone" dataKey="qc_pass" stackId="1" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} name="QC Pass Rate" />
                  <Area type="monotone" dataKey="accuracy" stackId="2" stroke="#16a34a" fill="#16a34a" fillOpacity={0.6} name="Standard Accuracy" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Productivity Tab */}
        <TabsContent value="productivity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meters/Day</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(operationalData.productivity.meters_per_day)}</div>
                <p className="text-xs text-muted-foreground">
                  Daily drilling rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Samples/Day</CardTitle>
                <TestTube className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(operationalData.productivity.samples_per_day)}</div>
                <p className="text-xs text-muted-foreground">
                  Daily sampling rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Equipment Uptime</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatNumber(operationalData.productivity.equipment_uptime)}%</div>
                <Progress value={operationalData.productivity.equipment_uptime} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Productivity</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getEfficiencyColor(operationalData.productivity.overall_productivity)}`}>
                  {formatNumber(operationalData.productivity.overall_productivity)}%
                </div>
                <Progress value={operationalData.productivity.overall_productivity} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Active Equipment</span>
                    <span className="text-lg font-bold">{operationalData.resources.active_equipment}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Crew Count</span>
                    <span className="text-lg font-bold">{operationalData.resources.crew_count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Utilization Rate</span>
                    <span className="text-lg font-bold text-blue-600">{formatNumber(operationalData.resources.utilization_rate)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Maintenance Scheduled</span>
                    <span className="text-lg font-bold text-yellow-600">{operationalData.resources.maintenance_scheduled}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {operationalData.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-800">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationalIntelligence;