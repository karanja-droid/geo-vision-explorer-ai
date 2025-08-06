import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Target, 
  Award, 
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon
} from "lucide-react";
import { useSites } from '@/hooks/useSites';
import { useMineralDeposits } from '@/hooks/useMineralDeposits';
import { usePredictions } from '@/hooks/usePredictions';
import { useAIModels } from '@/hooks/useAIModels';

const EnhancedMetrics = () => {
  const { sites, getSiteStats } = useSites();
  const { deposits, getDepositStats, getDepositsByMineralType } = useMineralDeposits();
  const { predictions, getPredictionStats } = usePredictions();
  const { getModelStats } = useAIModels();

  const siteStats = getSiteStats();
  const depositStats = getDepositStats();
  const predictionStats = getPredictionStats();
  const modelStats = getModelStats();
  const depositsByType = getDepositsByMineralType();

  // Transform data for charts
  const siteTypeData = [
    { name: 'Drilling', value: siteStats.drilling, fill: '#ef4444' },
    { name: 'Sampling', value: siteStats.sampling, fill: '#10b981' },
    { name: 'Geophysics', value: siteStats.geophysics, fill: '#3b82f6' },
    { name: 'Geochemistry', value: siteStats.geochemistry, fill: '#f59e0b' },
    { name: 'Remote Sensing', value: siteStats.remote_sensing, fill: '#8b5cf6' }
  ];

  const mineralDistribution = Object.entries(depositsByType).map(([mineral, deposits]) => ({
    name: mineral.charAt(0).toUpperCase() + mineral.slice(1),
    count: deposits.length,
    avgConfidence: Math.round(deposits.reduce((sum, d) => sum + (d.confidence_level || 0), 0) / deposits.length) || 0,
    fill: mineral === 'gold' ? '#fbbf24' :
          mineral === 'copper' ? '#f97316' :
          mineral === 'lithium' ? '#a855f7' :
          mineral === 'silver' ? '#9ca3af' : '#64748b'
  }));

  // Mock time series data for trends
  const trendData = [
    { month: 'Jan', sites: 12, deposits: 8, predictions: 15 },
    { month: 'Feb', sites: 18, deposits: 14, predictions: 22 },
    { month: 'Mar', sites: 25, deposits: 19, predictions: 28 },
    { month: 'Apr', sites: 32, deposits: 26, predictions: 35 },
    { month: 'May', sites: 28, deposits: 31, predictions: 42 },
    { month: 'Jun', sites: 35, deposits: 38, predictions: 48 }
  ];

  const confidenceDistribution = [
    { range: '90-100%', count: deposits.filter(d => (d.confidence_level || 0) >= 90).length },
    { range: '80-89%', count: deposits.filter(d => (d.confidence_level || 0) >= 80 && (d.confidence_level || 0) < 90).length },
    { range: '70-79%', count: deposits.filter(d => (d.confidence_level || 0) >= 70 && (d.confidence_level || 0) < 80).length },
    { range: '60-69%', count: deposits.filter(d => (d.confidence_level || 0) >= 60 && (d.confidence_level || 0) < 70).length },
    { range: '<60%', count: deposits.filter(d => (d.confidence_level || 0) < 60).length }
  ];

  const chartConfig = {
    sites: { label: "Sites", color: "#3b82f6" },
    deposits: { label: "Deposits", color: "#10b981" },
    predictions: { label: "Predictions", color: "#f59e0b" },
    confidence: { label: "Confidence", color: "#8b5cf6" }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Sites</p>
                <p className="text-2xl font-bold text-slate-100">{sites.length}</p>
                <p className="text-green-400 text-sm flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +12% from last month
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Mineral Deposits</p>
                <p className="text-2xl font-bold text-slate-100">{deposits.length}</p>
                <p className="text-green-400 text-sm flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {depositStats.avgConfidence}% avg confidence
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">AI Predictions</p>
                <p className="text-2xl font-bold text-slate-100">{predictions.length}</p>
                <p className="text-yellow-400 text-sm flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {predictionStats.completed} completed
                </p>
              </div>
              <LineChartIcon className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Active Models</p>
                <p className="text-2xl font-bold text-slate-100">{modelStats.activeModels}</p>
                <p className="text-purple-400 text-sm flex items-center gap-1">
                  <PieChartIcon className="w-3 h-3" />
                  {modelStats.avgAccuracy}% accuracy
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Site Distribution */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-blue-400" />
              Site Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={siteTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {siteTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-4">
              {siteTypeData.map((item) => (
                <Badge key={item.name} variant="secondary" className="bg-slate-700/50 text-slate-300">
                  {item.name}: {item.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mineral Distribution */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-400" />
              Mineral Type Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mineralDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Growth Trends */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-yellow-400" />
              Growth Trends (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="sites" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="deposits" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="predictions" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Confidence Distribution */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Confidence Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceDistribution} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="range" type="category" stroke="#9ca3af" width={80} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedMetrics;