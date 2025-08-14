/**
 * Executive Dashboard Component
 * 
 * Provides high-level KPIs and metrics for C-suite executives
 * including financial performance, operational efficiency, and strategic metrics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Target, 
  AlertTriangle,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  RefreshCw
} from 'lucide-react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from 'recharts';

interface KPIMetric {
  value: number;
  currency?: string;
  unit?: string;
  change_percent?: number;
  trend?: 'up' | 'down' | 'stable';
  target?: number;
  performance?: 'excellent' | 'good' | 'warning' | 'critical';
}

interface ExecutiveDashboardData {
  timestamp: string;
  organization_id: string;
  time_range: string;
  financial: {
    total_revenue: KPIMetric;
    total_costs: KPIMetric;
    gross_profit: KPIMetric;
    roi: KPIMetric;
    cost_per_meter: KPIMetric;
  };
  operational: {
    drilling_progress: {
      total_meters: number;
      daily_average: number;
      target_daily: number;
      efficiency: number;
    };
    sampling_rate: {
      total_samples: number;
      samples_per_day: number;
      target_daily: number;
      efficiency: number;
    };
    equipment_utilization: KPIMetric;
    quality_score: KPIMetric;
  };
  strategic: {
    project_completion: {
      completed_projects: number;
      total_projects: number;
      completion_rate: number;
      target: number;
      performance: string;
    };
    client_satisfaction: KPIMetric;
    market_share: KPIMetric;
    innovation_index: {
      ai_adoption: number;
      automation_level: number;
      digital_maturity: number;
      performance: string;
    };
  };
  risk: {
    safety_score: KPIMetric;
    compliance_score: KPIMetric;
    financial_risk: {
      risk_level: string;
      exposure_amount: number;
      mitigation_coverage: number;
    };
    operational_risk: {
      risk_level: string;
      critical_dependencies: number;
      contingency_plans: number;
    };
  };
  summary: {
    overall_status: string;
    key_insights: string[];
    action_items: string[];
    next_review: string;
  };
}

const ExecutiveDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockData: ExecutiveDashboardData = {
        timestamp: new Date().toISOString(),
        organization_id: 'org_123',
        time_range: timeRange,
        financial: {
          total_revenue: {
            value: 2500000,
            currency: 'USD',
            change_percent: 15.2,
            trend: 'up'
          },
          total_costs: {
            value: 1800000,
            currency: 'USD',
            change_percent: 8.5,
            trend: 'up'
          },
          gross_profit: {
            value: 700000,
            currency: 'USD',
            change_percent: 22.1,
            trend: 'up'
          },
          roi: {
            value: 38.9,
            unit: 'percent',
            target: 35.0,
            performance: 'excellent'
          },
          cost_per_meter: {
            value: 125.50,
            currency: 'USD',
            target: 130.00,
            performance: 'good'
          }
        },
        operational: {
          drilling_progress: {
            total_meters: 4500,
            daily_average: 150,
            target_daily: 150,
            efficiency: 100
          },
          sampling_rate: {
            total_samples: 1500,
            samples_per_day: 50,
            target_daily: 50,
            efficiency: 100
          },
          equipment_utilization: {
            value: 87.5,
            unit: 'percent',
            target: 85.0,
            performance: 'excellent'
          },
          quality_score: {
            value: 92.3,
            unit: 'percent',
            target: 90.0,
            performance: 'excellent'
          }
        },
        strategic: {
          project_completion: {
            completed_projects: 12,
            total_projects: 15,
            completion_rate: 80.0,
            target: 85.0,
            performance: 'good'
          },
          client_satisfaction: {
            value: 4.6,
            unit: 'rating',
            target: 4.5,
            performance: 'excellent'
          },
          market_share: {
            value: 12.5,
            unit: 'percent',
            target: 15.0,
            performance: 'good'
          },
          innovation_index: {
            ai_adoption: 85.0,
            automation_level: 72.0,
            digital_maturity: 78.5,
            performance: 'excellent'
          }
        },
        risk: {
          safety_score: {
            value: 96.2,
            unit: 'percent',
            target: 95.0,
            performance: 'excellent'
          },
          compliance_score: {
            value: 98.5,
            unit: 'percent',
            target: 95.0,
            performance: 'excellent'
          },
          financial_risk: {
            risk_level: 'low',
            exposure_amount: 150000,
            mitigation_coverage: 85.0
          },
          operational_risk: {
            risk_level: 'medium',
            critical_dependencies: 3,
            contingency_plans: 8
          }
        },
        summary: {
          overall_status: 'excellent',
          key_insights: [
            'ROI exceeds target by 3.9 percentage points',
            'Drilling operations ahead of schedule',
            'Safety performance exceeds industry standards'
          ],
          action_items: [
            'Continue current operational efficiency initiatives',
            'Monitor equipment utilization for optimization opportunities',
            'Prepare for Q2 expansion based on strong performance'
          ],
          next_review: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      };

      setDashboardData(mockData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPerformanceBadge = (performance: string) => {
    switch (performance) {
      case 'excellent': return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
      case 'good': return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTrendIcon = (trend: string, changePercent?: number) => {
    if (trend === 'up' || (changePercent && changePercent > 0)) {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (trend === 'down' || (changePercent && changePercent < 0)) {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number, unit?: string) => {
    const formatted = new Intl.NumberFormat('en-US').format(value);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Data Available</h3>
          <p className="text-gray-600">Unable to load dashboard data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-gray-600">
            Last updated: {new Date(dashboardData.timestamp).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Overall Performance
            {getPerformanceBadge(dashboardData.summary.overall_status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Key Insights</h4>
              <ul className="space-y-1">
                {dashboardData.summary.key_insights.map((insight, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Action Items</h4>
              <ul className="space-y-1">
                {dashboardData.summary.action_items.map((item, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full mt-2 flex-shrink-0"></div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Tabs */}
      <Tabs defaultValue="financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
          <TabsTrigger value="strategic">Strategic</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        {/* Financial KPIs */}
        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.financial.total_revenue.value)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(dashboardData.financial.total_revenue.trend!, dashboardData.financial.total_revenue.change_percent)}
                  <span className="ml-1">
                    {dashboardData.financial.total_revenue.change_percent}% from last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(dashboardData.financial.gross_profit.value)}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(dashboardData.financial.gross_profit.trend!, dashboardData.financial.gross_profit.change_percent)}
                  <span className="ml-1">
                    {dashboardData.financial.gross_profit.change_percent}% from last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ROI</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData.financial.roi.value}%
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Target: {dashboardData.financial.roi.target}%
                  </span>
                  {getPerformanceBadge(dashboardData.financial.roi.performance!)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operational KPIs */}
        <TabsContent value="operational" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Drilling Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Meters</span>
                    <span className="text-2xl font-bold">
                      {formatNumber(dashboardData.operational.drilling_progress.total_meters)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Daily Average</span>
                    <span className="text-lg">
                      {formatNumber(dashboardData.operational.drilling_progress.daily_average)} m/day
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Efficiency</span>
                    <Badge className={dashboardData.operational.drilling_progress.efficiency >= 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {dashboardData.operational.drilling_progress.efficiency}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Overall Quality Score</span>
                    <span className="text-2xl font-bold">
                      {dashboardData.operational.quality_score.value}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Target</span>
                    <span className="text-lg">
                      {dashboardData.operational.quality_score.target}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Performance</span>
                    {getPerformanceBadge(dashboardData.operational.quality_score.performance!)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Strategic KPIs */}
        <TabsContent value="strategic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Project Completion</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {dashboardData.strategic.project_completion.completed_projects}/
                  {dashboardData.strategic.project_completion.total_projects}
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {dashboardData.strategic.project_completion.completion_rate}% completion rate
                </div>
                {getPerformanceBadge(dashboardData.strategic.project_completion.performance)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Client Satisfaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {dashboardData.strategic.client_satisfaction.value}/5.0
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Target: {dashboardData.strategic.client_satisfaction.target}/5.0
                </div>
                {getPerformanceBadge(dashboardData.strategic.client_satisfaction.performance!)}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Innovation Index</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">AI Adoption</span>
                    <span className="font-semibold">{dashboardData.strategic.innovation_index.ai_adoption}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Automation</span>
                    <span className="font-semibold">{dashboardData.strategic.innovation_index.automation_level}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Digital Maturity</span>
                    <span className="font-semibold">{dashboardData.strategic.innovation_index.digital_maturity}%</span>
                  </div>
                  <div className="pt-2">
                    {getPerformanceBadge(dashboardData.strategic.innovation_index.performance)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk KPIs */}
        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Safety & Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Safety Score</span>
                    <div className="text-right">
                      <div className="text-lg font-bold">{dashboardData.risk.safety_score.value}%</div>
                      {getPerformanceBadge(dashboardData.risk.safety_score.performance!)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Compliance Score</span>
                    <div className="text-right">
                      <div className="text-lg font-bold">{dashboardData.risk.compliance_score.value}%</div>
                      {getPerformanceBadge(dashboardData.risk.compliance_score.performance!)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Financial Risk</span>
                    <Badge className={dashboardData.risk.financial_risk.risk_level === 'low' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {dashboardData.risk.financial_risk.risk_level.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Operational Risk</span>
                    <Badge className={dashboardData.risk.operational_risk.risk_level === 'low' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {dashboardData.risk.operational_risk.risk_level.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dashboardData.risk.operational_risk.contingency_plans} contingency plans active
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

export default ExecutiveDashboard;