import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Star,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useApiQuery } from '@/hooks/useApiQuery';

interface BetaUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company: string;
  experience_level: string;
  beta_phase: 'closed' | 'extended' | 'open';
  status: 'invited' | 'active' | 'completed' | 'churned';
  signup_date: string;
  last_active?: string;
  feedback_score?: number;
}

interface BetaFeedback {
  id: string;
  user_id: string;
  feature_name: string;
  satisfaction_score: number;
  usage_frequency: string;
  feedback_text: string;
  timestamp: string;
}

interface BetaMetrics {
  id: string;
  feature_name: string;
  action_type: string;
  response_time_ms?: number;
  timestamp: string;
}

interface BetaAnalytics {
  user_distribution: {
    by_role: Record<string, number>;
    by_phase: Record<string, number>;
    by_experience: Record<string, number>;
    total_users: number;
  };
  satisfaction_scores: {
    average_score: number;
    total_responses: number;
    score_distribution: Record<string, number>;
  };
  performance_metrics: {
    average_response_time: number;
    p95_response_time: number;
    total_requests: number;
    fast_requests: number;
    slow_requests: number;
  };
  feature_adoption: Record<string, number>;
}

const BetaDashboard: React.FC = () => {
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7d');

  // Fetch beta data
  const { data: betaUsers, isLoading: usersLoading } = useApiQuery<BetaUser[]>({
    queryKey: ['beta-users', selectedPhase],
    queryFn: async () => {
      const response = await fetch(`/api/beta/users${selectedPhase !== 'all' ? `?phase=${selectedPhase}` : ''}`);
      return response.json();
    }
  });

  const { data: betaFeedback, isLoading: feedbackLoading } = useApiQuery<BetaFeedback[]>({
    queryKey: ['beta-feedback', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/beta/feedback?range=${timeRange}`);
      return response.json();
    }
  });

  const { data: betaMetrics, isLoading: metricsLoading } = useApiQuery<BetaMetrics[]>({
    queryKey: ['beta-metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/beta/metrics?range=${timeRange}`);
      return response.json();
    }
  });

  const { data: analytics, isLoading: analyticsLoading } = useApiQuery<BetaAnalytics>({
    queryKey: ['beta-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/beta/analytics');
      return response.json();
    }
  });

  // Calculate key metrics
  const keyMetrics = React.useMemo(() => {
    if (!analytics) return null;

    const satisfactionRate = (analytics.satisfaction_scores.average_score / 5) * 100;
    const performanceScore = analytics.performance_metrics.fast_requests / analytics.performance_metrics.total_requests * 100;
    const activeUsers = betaUsers?.filter(u => u.status === 'active').length || 0;
    const completionRate = betaUsers?.filter(u => u.status === 'completed').length || 0;

    return {
      satisfactionRate: Math.round(satisfactionRate),
      performanceScore: Math.round(performanceScore),
      activeUsers,
      completionRate: Math.round((completionRate / (betaUsers?.length || 1)) * 100)
    };
  }, [analytics, betaUsers]);

  // Prepare chart data
  const satisfactionChartData = React.useMemo(() => {
    if (!analytics) return [];
    
    return Object.entries(analytics.satisfaction_scores.score_distribution).map(([score, count]) => ({
      score: `${score} Stars`,
      count,
      percentage: Math.round((count / analytics.satisfaction_scores.total_responses) * 100)
    }));
  }, [analytics]);

  const featureAdoptionData = React.useMemo(() => {
    if (!analytics) return [];
    
    return Object.entries(analytics.feature_adoption)
      .slice(0, 8)
      .map(([feature, usage]) => ({
        feature: feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        usage,
        percentage: Math.round((usage / analytics.user_distribution.total_users) * 100)
      }));
  }, [analytics]);

  const phaseColors = {
    closed: '#10B981',
    extended: '#F59E0B', 
    open: '#3B82F6'
  };

  if (usersLoading || feedbackLoading || metricsLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Beta Testing Dashboard</h1>
          <p className="text-gray-600 mt-1">Monitor beta user engagement and feedback</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedPhase === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedPhase('all')}
            size="sm"
          >
            All Phases
          </Button>
          <Button
            variant={selectedPhase === 'closed' ? 'default' : 'outline'}
            onClick={() => setSelectedPhase('closed')}
            size="sm"
          >
            Closed Beta
          </Button>
          <Button
            variant={selectedPhase === 'extended' ? 'default' : 'outline'}
            onClick={() => setSelectedPhase('extended')}
            size="sm"
          >
            Extended Beta
          </Button>
          <Button
            variant={selectedPhase === 'open' ? 'default' : 'outline'}
            onClick={() => setSelectedPhase('open')}
            size="sm"
          >
            Open Beta
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {keyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Satisfaction</CardTitle>
              <Star className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.satisfactionRate}%</div>
              <Progress value={keyMetrics.satisfactionRate} className="mt-2" />
              <p className="text-xs text-gray-600 mt-1">
                {analytics?.satisfaction_scores.average_score.toFixed(1)}/5.0 average score
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.performanceScore}%</div>
              <Progress value={keyMetrics.performanceScore} className="mt-2" />
              <p className="text-xs text-gray-600 mt-1">
                {analytics?.performance_metrics.average_response_time}ms avg response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.activeUsers}</div>
              <p className="text-xs text-gray-600 mt-1">
                of {analytics?.user_distribution.total_users} total beta users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Target className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keyMetrics.completionRate}%</div>
              <Progress value={keyMetrics.completionRate} className="mt-2" />
              <p className="text-xs text-gray-600 mt-1">
                Beta program completion
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Alert */}
      {keyMetrics && keyMetrics.satisfactionRate >= 95 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            🎉 Excellent! Beta testing is exceeding targets with {keyMetrics.satisfactionRate}% satisfaction rate. 
            Ready for market launch preparation.
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Alert */}
      {keyMetrics && keyMetrics.satisfactionRate < 85 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            ⚠️ Satisfaction rate is below target (85%). Review feedback and address key issues before launch.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Distribution by Phase */}
            <Card>
              <CardHeader>
                <CardTitle>Beta Phase Distribution</CardTitle>
                <CardDescription>Users across different beta phases</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics && (
                  <div className="space-y-3">
                    {Object.entries(analytics.user_distribution.by_phase).map(([phase, count]) => (
                      <div key={phase} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: phaseColors[phase as keyof typeof phaseColors] }}
                          />
                          <span className="capitalize">{phase} Beta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{count}</span>
                          <Badge variant="secondary">
                            {Math.round((count / analytics.user_distribution.total_users) * 100)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Satisfaction Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Satisfaction Scores</CardTitle>
                <CardDescription>User satisfaction rating distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={satisfactionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="score" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Beta Users</CardTitle>
              <CardDescription>
                {betaUsers?.length || 0} total beta users across all phases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {betaUsers?.slice(0, 10).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {user.full_name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-gray-600">{user.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={user.status === 'active' ? 'default' : 'secondary'}
                      >
                        {user.status}
                      </Badge>
                      <Badge variant="outline">
                        {user.role.replace(/_/g, ' ')}
                      </Badge>
                      <Badge 
                        style={{ 
                          backgroundColor: phaseColors[user.beta_phase],
                          color: 'white'
                        }}
                      >
                        {user.beta_phase}
                      </Badge>
                    </div>
                  </div>
                ))}
                {betaUsers && betaUsers.length > 10 && (
                  <p className="text-center text-gray-600">
                    ... and {betaUsers.length - 10} more users
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
              <CardDescription>Latest user feedback and suggestions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {betaFeedback?.slice(0, 5).map((feedback) => (
                  <div key={feedback.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{feedback.feature_name.replace(/_/g, ' ')}</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < feedback.satisfaction_score
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <Badge variant="outline">{feedback.usage_frequency}</Badge>
                    </div>
                    <p className="text-gray-700">{feedback.feedback_text}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(feedback.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
                <CardDescription>API response time performance</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Average Response Time</span>
                      <span className="font-medium">{analytics.performance_metrics.average_response_time}ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>95th Percentile</span>
                      <span className="font-medium">{analytics.performance_metrics.p95_response_time}ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Fast Requests (&lt;2s)</span>
                      <span className="font-medium text-green-600">
                        {Math.round((analytics.performance_metrics.fast_requests / analytics.performance_metrics.total_requests) * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Slow Requests (≥2s)</span>
                      <span className="font-medium text-red-600">
                        {Math.round((analytics.performance_metrics.slow_requests / analytics.performance_metrics.total_requests) * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Overall system performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Uptime</span>
                    <Badge className="bg-green-100 text-green-800">99.95%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Error Rate</span>
                    <Badge className="bg-green-100 text-green-800">0.05%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Requests</span>
                    <span className="font-medium">{analytics?.performance_metrics.total_requests.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Adoption</CardTitle>
              <CardDescription>Most used features during beta testing</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureAdoptionData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="feature" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="usage" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BetaDashboard;