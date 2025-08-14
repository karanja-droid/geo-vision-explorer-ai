import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Drill, 
  Target, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calendar,
  DollarSign,
  FileText,
  Download,
  Plus,
  Filter,
  BarChart3,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/DataTable';
import { LoadingSpinner } from '@/components/ui/loading';
import { Progress } from '@/components/ui/progress';
import { DrillPlanForm } from '@/components/driller/DrillPlanForm';
import { DailyReportForm } from '@/components/driller/DailyReportForm';
import { DrillProgressChart } from '@/components/driller/DrillProgressChart';
import { ExportDialog } from '@/components/exports/ExportDialog';

interface DrillerDashboardData {
  active_drill_plans: number;
  completed_drill_plans: number;
  total_metres_drilled: number;
  average_rop: number;
  total_downtime_hours: number;
  safety_incidents_count: number;
  plans_by_status: Record<string, number>;
  drilling_progress: Record<string, number>;
  budget_utilization: number;
  on_schedule_percentage: number;
}

interface DrillPlan {
  id: string;
  project_id: string;
  plan_name: string;
  drill_type: string;
  collar_location: {
    type: string;
    coordinates: [number, number];
  };
  azimuth: number;
  dip: number;
  target_depth: number;
  planned_start_date: string;
  estimated_duration_days: number;
  budget_estimate?: number;
  currency: string;
  drilling_contractor?: string;
  rig_type?: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

interface DailyReport {
  id: string;
  drill_plan_id: string;
  report_date: string;
  shift: string;
  metres_drilled: number;
  total_depth: number;
  core_recovery_percent?: number;
  drilling_fluid?: string;
  downtime_hours: number;
  downtime_reason?: string;
  rop_average?: number;
  safety_incidents: number;
  weather_conditions?: string;
  driller_name: string;
  created_at: string;
}

interface DrillProgress {
  drill_plan_id: string;
  plan_name: string;
  target_depth: number;
  current_depth: number;
  progress_percentage: number;
  days_elapsed: number;
  estimated_days_remaining: number;
  average_rop: number;
  budget_spent: number;
  budget_remaining: number;
}

export default function Driller() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DrillerDashboardData>({
    queryKey: ['driller-dashboard', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/driller/dashboard${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    }
  });

  // Fetch drill plans
  const { data: drillPlans, isLoading: plansLoading } = useQuery<DrillPlan[]>({
    queryKey: ['drill-plans', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/driller/drill-plans${params}`);
      if (!response.ok) throw new Error('Failed to fetch drill plans');
      return response.json();
    }
  });

  // Fetch daily reports
  const { data: dailyReports, isLoading: reportsLoading } = useQuery<DailyReport[]>({
    queryKey: ['daily-reports', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/driller/daily-reports${params}`);
      if (!response.ok) throw new Error('Failed to fetch daily reports');
      return response.json();
    }
  });

  const handleExport = (type: string) => {
    setExportType(type);
    setShowExportDialog(true);
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'active': return 'default';
      case 'drilling': return 'secondary';
      case 'completed': return 'secondary';
      case 'on_hold': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const getDrillTypeIcon = (type: string) => {
    switch (type) {
      case 'diamond': return '💎';
      case 'rc': return '🔄';
      case 'aircore': return '💨';
      case 'rotary': return '⚙️';
      case 'percussion': return '🔨';
      default: return '🔧';
    }
  };

  const drillPlanColumns = [
    {
      accessorKey: 'plan_name',
      header: 'Plan Name'
    },
    {
      accessorKey: 'drill_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <span>{getDrillTypeIcon(row.getValue('drill_type'))}</span>
          <Badge variant="outline">{row.getValue('drill_type')}</Badge>
        </div>
      )
    },
    {
      accessorKey: 'target_depth',
      header: 'Target Depth (m)',
      cell: ({ row }: any) => `${row.getValue('target_depth')}m`
    },
    {
      accessorKey: 'planned_start_date',
      header: 'Start Date',
      cell: ({ row }: any) => new Date(row.getValue('planned_start_date')).toLocaleDateString()
    },
    {
      accessorKey: 'estimated_duration_days',
      header: 'Duration',
      cell: ({ row }: any) => `${row.getValue('estimated_duration_days')} days`
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status');
        return <Badge variant={getStatusColor(status)}>{status}</Badge>;
      }
    },
    {
      accessorKey: 'drilling_contractor',
      header: 'Contractor',
      cell: ({ row }: any) => row.getValue('drilling_contractor') || 'N/A'
    }
  ];

  const dailyReportColumns = [
    {
      accessorKey: 'report_date',
      header: 'Date',
      cell: ({ row }: any) => new Date(row.getValue('report_date')).toLocaleDateString()
    },
    {
      accessorKey: 'shift',
      header: 'Shift',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('shift')}</Badge>
      )
    },
    {
      accessorKey: 'metres_drilled',
      header: 'Metres Drilled',
      cell: ({ row }: any) => `${row.getValue('metres_drilled')}m`
    },
    {
      accessorKey: 'total_depth',
      header: 'Total Depth',
      cell: ({ row }: any) => `${row.getValue('total_depth')}m`
    },
    {
      accessorKey: 'rop_average',
      header: 'ROP (m/hr)',
      cell: ({ row }: any) => {
        const rop = row.getValue('rop_average');
        return rop ? `${rop.toFixed(1)}` : 'N/A';
      }
    },
    {
      accessorKey: 'downtime_hours',
      header: 'Downtime (hrs)',
      cell: ({ row }: any) => {
        const downtime = row.getValue('downtime_hours');
        return downtime > 0 ? (
          <Badge variant="destructive">{downtime}h</Badge>
        ) : (
          <Badge variant="secondary">0h</Badge>
        );
      }
    },
    {
      accessorKey: 'safety_incidents',
      header: 'Safety',
      cell: ({ row }: any) => {
        const incidents = row.getValue('safety_incidents');
        return incidents > 0 ? (
          <Badge variant="destructive">{incidents} incidents</Badge>
        ) : (
          <Badge variant="default">✓ Safe</Badge>
        );
      }
    },
    {
      accessorKey: 'driller_name',
      header: 'Driller'
    }
  ];

  if (dashboardLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drilling Operations</h1>
          <p className="text-muted-foreground">
            Drill planning, progress tracking, and operational management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('progress_vs_plan')}>
            <FileText className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="plans">Drill Plans</TabsTrigger>
          <TabsTrigger value="reports">Daily Reports</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Plans</CardTitle>
                <Drill className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.active_drill_plans || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.completed_drill_plans || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Metres Drilled</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.total_metres_drilled?.toLocaleString() || 0}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg ROP: {dashboardData?.average_rop?.toFixed(1) || 0} m/hr
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Schedule Performance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(dashboardData?.on_schedule_percentage || 0)}
                </div>
                <p className="text-xs text-muted-foreground">On schedule</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Safety Record</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.safety_incidents_count || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.total_downtime_hours?.toFixed(1) || 0}h downtime
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Drilling Progress (30 Days)</CardTitle>
                <CardDescription>Daily metres drilled over time</CardDescription>
              </CardHeader>
              <CardContent>
                <DrillProgressChart data={dashboardData?.drilling_progress || {}} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Plans by Status</CardTitle>
                <CardDescription>Current drill plan distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.plans_by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Drill className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                      </div>
                      <Badge variant={getStatusColor(status)}>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Utilization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget Utilization
              </CardTitle>
              <CardDescription>
                Current budget usage across all drilling operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Budget Utilized</span>
                  <span>{formatPercentage(dashboardData?.budget_utilization || 0)}</span>
                </div>
                <Progress value={dashboardData?.budget_utilization || 0} className="w-full" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Drill Plans</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowPlanForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Plan
              </Button>
              <Button variant="outline" onClick={() => handleExport('drill_plans')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {plansLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={drillPlanColumns}
              data={drillPlans || []}
              searchKey="plan_name"
            />
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Daily Reports</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowReportForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Report
              </Button>
              <Button variant="outline" onClick={() => handleExport('daily_reports')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {reportsLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={dailyReportColumns}
              data={dailyReports || []}
              searchKey="driller_name"
            />
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Drilling Progress</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleExport('progress_summary')}>
                <Download className="h-4 w-4 mr-2" />
                Export Progress
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {drillPlans?.filter(plan => plan.status === 'active' || plan.status === 'drilling').map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.plan_name}</span>
                    <Badge variant={getStatusColor(plan.status)}>{plan.status}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {plan.drill_type} • Target: {plan.target_depth}m
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>65%</span> {/* Would calculate from actual data */}
                      </div>
                      <Progress value={65} className="w-full" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Current Depth:</span>
                        <p className="font-medium">325m</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days Elapsed:</span>
                        <p className="font-medium">12 days</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg ROP:</span>
                        <p className="font-medium">2.3 m/hr</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Est. Remaining:</span>
                        <p className="font-medium">8 days</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                  onClick={() => handleExport('progress_vs_plan')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Progress vs Plan
                </CardTitle>
                <CardDescription>
                  Gantt charts, metres per day, and ROP curves
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('deviation_analysis')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Deviation Analysis
                </CardTitle>
                <CardDescription>
                  Hole deviation and recovery analysis
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('cost_analysis')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Analysis
                </CardTitle>
                <CardDescription>
                  Cost vs budget and per-hole drill summary
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('performance_metrics')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
                <CardDescription>
                  ROP analysis, downtime tracking, efficiency metrics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('safety_report')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Safety Report
                </CardTitle>
                <CardDescription>
                  Incident tracking and safety performance
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('contractor_performance')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Contractor Performance
                </CardTitle>
                <CardDescription>
                  Contractor comparison and performance metrics
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms and Dialogs */}
      {showPlanForm && (
        <DrillPlanForm
          onClose={() => setShowPlanForm(false)}
          onSuccess={() => {
            setShowPlanForm(false);
            // Refetch data
          }}
        />
      )}

      {showReportForm && (
        <DailyReportForm
          onClose={() => setShowReportForm(false)}
          onSuccess={() => {
            setShowReportForm(false);
            // Refetch data
          }}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          module="driller"
          reportType={exportType}
          projectId={selectedProjectId}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}