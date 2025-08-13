import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  Users, 
  Leaf, 
  BarChart3,
  PieChart,
  Download,
  Calendar
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface BusinessIntelligenceDashboardProps {
  projectId: string;
}

interface KPIMeasurement {
  id: string;
  kpi_id: string;
  measurement_date: string;
  actual_value: number;
  target_value: number;
  variance_percentage: number;
  trend: 'improving' | 'stable' | 'declining';
  kpi_definitions: {
    kpi_name: string;
    kpi_category: string;
    unit: string;
  };
}

interface EconomicModel {
  id: string;
  model_name: string;
  commodity: string;
  npv: number;
  irr: number;
  payback_period_years: number;
  resource_estimate: number;
  grade_estimate: number;
  created_at: string;
}

interface RiskAssessment {
  id: string;
  risk_category: string;
  risk_description: string;
  probability: string;
  impact: string;
  risk_score: number;
  status: string;
}

interface ESGMetric {
  id: string;
  metric_category: 'environmental' | 'social' | 'governance';
  metric_name: string;
  metric_value: number;
  unit: string;
  target_value: number;
  compliance_status: string;
  measurement_date: string;
}

const BusinessIntelligenceDashboard: React.FC<BusinessIntelligenceDashboardProps> = ({ projectId }) => {
  const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y'>('90d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch KPI measurements
  const { data: kpiData, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpi-measurements', projectId, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_measurements')
        .select(`
          *,
          kpi_definitions (
            kpi_name,
            kpi_category,
            unit
          )
        `)
        .eq('project_id', projectId)
        .order('measurement_date', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as KPIMeasurement[];
    }
  });

  // Fetch economic models
  const { data: economicModels, isLoading: economicLoading } = useQuery({
    queryKey: ['economic-models', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('economic_models')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EconomicModel[];
    }
  });

  // Fetch risk assessments
  const { data: riskAssessments, isLoading: riskLoading } = useQuery({
    queryKey: ['risk-assessments', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_assessments')
        .select('*')
        .eq('project_id', projectId)
        .order('risk_score', { ascending: false });
      
      if (error) throw error;
      return data as RiskAssessment[];
    }
  });

  // Fetch ESG metrics
  const { data: esgMetrics, isLoading: esgLoading } = useQuery({
    queryKey: ['esg-metrics', projectId, timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('esg_metrics')
        .select('*')
        .eq('project_id', projectId)
        .order('measurement_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ESGMetric[];
    }
  });

  // Process data for charts
  const kpiChartData = kpiData?.reduce((acc, measurement) => {
    const date = new Date(measurement.measurement_date).toLocaleDateString();
    const existingPoint = acc.find(point => point.date === date);
    
    if (existingPoint) {
      existingPoint[measurement.kpi_definitions.kpi_name] = measurement.actual_value;
    } else {
      acc.push({
        date,
        [measurement.kpi_definitions.kpi_name]: measurement.actual_value
      });
    }
    
    return acc;
  }, [] as any[]) || [];

  const riskDistribution = riskAssessments?.reduce((acc, risk) => {
    const category = risk.risk_category;
    const existing = acc.find(item => item.name === category);
    
    if (existing) {
      existing.value += 1;
      existing.totalRisk += risk.risk_score;
    } else {
      acc.push({
        name: category,
        value: 1,
        totalRisk: risk.risk_score,
        avgRisk: risk.risk_score
      });
    }
    
    return acc;
  }, [] as any[]) || [];

  // Calculate average risk for each category
  riskDistribution.forEach(item => {
    item.avgRisk = item.totalRisk / item.value;
  });

  const esgRadarData = [
    {
      category: 'Environmental',
      score: esgMetrics?.filter(m => m.metric_category === 'environmental')
        .reduce((sum, m) => sum + (m.metric_value / m.target_value * 100), 0) / 
        Math.max(esgMetrics?.filter(m => m.metric_category === 'environmental').length || 1, 1) || 0
    },
    {
      category: 'Social',
      score: esgMetrics?.filter(m => m.metric_category === 'social')
        .reduce((sum, m) => sum + (m.metric_value / m.target_value * 100), 0) / 
        Math.max(esgMetrics?.filter(m => m.metric_category === 'social').length || 1, 1) || 0
    },
    {
      category: 'Governance',
      score: esgMetrics?.filter(m => m.metric_category === 'governance')
        .reduce((sum, m) => sum + (m.metric_value / m.target_value * 100), 0) / 
        Math.max(esgMetrics?.filter(m => m.metric_category === 'governance').length || 1, 1) || 0
    }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'non_compliant':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Calculate summary metrics
  const totalNPV = economicModels?.reduce((sum, model) => sum + model.npv, 0) || 0;
  const avgIRR = economicModels?.reduce((sum, model) => sum + model.irr, 0) / Math.max(economicModels?.length || 1, 1) || 0;
  const highRiskCount = riskAssessments?.filter(r => r.risk_score >= 70).length || 0;
  const complianceRate = esgMetrics?.filter(m => m.compliance_status === 'compliant').length / Math.max(esgMetrics?.length || 1, 1) * 100 || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business Intelligence Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive analytics and performance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total NPV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalNPV / 1000000).toFixed(1)}M</div>
            <p className="text-xs text-muted-foreground">
              Net Present Value across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average IRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgIRR.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Internal Rate of Return
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{highRiskCount}</div>
            <p className="text-xs text-muted-foreground">
              Risk score ≥ 70
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ESG Compliance</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{complianceRate.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">
              Metrics in compliance
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="kpis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="economic">Economic Models</TabsTrigger>
          <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="esg">ESG Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* KPI Trends Chart */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>KPI Trends</CardTitle>
                <CardDescription>Performance indicators over time</CardDescription>
              </CardHeader>
              <CardContent>
                {kpiChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={kpiChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="Safety Incident Rate" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Water Usage Efficiency" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Production Cost" 
                        stroke="#10b981" 
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No KPI data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent KPI Measurements */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent KPI Measurements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {kpiLoading ? (
                    <div className="text-center py-4">Loading KPIs...</div>
                  ) : kpiData?.slice(0, 6).map((measurement) => (
                    <div key={measurement.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getTrendIcon(measurement.trend)}
                        <div>
                          <div className="font-medium">{measurement.kpi_definitions.kpi_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {measurement.kpi_definitions.kpi_category}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {measurement.actual_value.toFixed(2)} {measurement.kpi_definitions.unit}
                        </div>
                        <div className={`text-sm ${
                          measurement.variance_percentage > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {measurement.variance_percentage > 0 ? '+' : ''}{measurement.variance_percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="economic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {economicLoading ? (
              <div className="md:col-span-2 text-center py-8">Loading economic models...</div>
            ) : economicModels?.map((model) => (
              <Card key={model.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{model.model_name}</CardTitle>
                  <CardDescription>
                    {model.commodity} • {new Date(model.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">NPV</div>
                        <div className="font-medium text-lg">
                          ${(model.npv / 1000000).toFixed(1)}M
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">IRR</div>
                        <div className="font-medium text-lg">{model.irr.toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Payback Period</div>
                        <div className="font-medium">{model.payback_period_years.toFixed(1)} years</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Resource Estimate</div>
                        <div className="font-medium">{(model.resource_estimate / 1000).toFixed(0)}k tonnes</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="text-sm text-muted-foreground">Grade Estimate</div>
                      <div className="font-medium">{model.grade_estimate.toFixed(2)} g/t</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Risk Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsPieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Risk List */}
            <Card>
              <CardHeader>
                <CardTitle>High Priority Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskLoading ? (
                    <div className="text-center py-4">Loading risks...</div>
                  ) : riskAssessments?.slice(0, 5).map((risk) => (
                    <div key={risk.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{risk.risk_category}</Badge>
                        <span className={`font-medium ${getRiskColor(risk.risk_score)}`}>
                          {risk.risk_score.toFixed(0)}
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1">{risk.risk_description}</div>
                      <div className="text-xs text-muted-foreground">
                        {risk.probability} probability • {risk.impact} impact
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="esg" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* ESG Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>ESG Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={esgRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="ESG Score"
                      dataKey="score"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* ESG Metrics List */}
            <Card>
              <CardHeader>
                <CardTitle>Recent ESG Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {esgLoading ? (
                    <div className="text-center py-4">Loading ESG metrics...</div>
                  ) : esgMetrics?.slice(0, 6).map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{metric.metric_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {metric.metric_category}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {metric.metric_value.toFixed(2)} {metric.unit}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={getComplianceColor(metric.compliance_status)}
                        >
                          {metric.compliance_status}
                        </Badge>
                      </div>
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

export default BusinessIntelligenceDashboard;