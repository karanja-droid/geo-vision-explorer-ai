import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TestTube, 
  FlaskConical, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Plus,
  Filter,
  BarChart3,
  Target
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/DataTable';
import { LoadingSpinner } from '@/components/ui/loading';
import { Progress } from '@/components/ui/progress';
import { SampleRegistrationForm } from '@/components/geochemist/SampleRegistrationForm';
import { AssayResultForm } from '@/components/geochemist/AssayResultForm';
import { QCDashboard } from '@/components/geochemistry/QCDashboard';
import { ExportDialog } from '@/components/exports/ExportDialog';

interface GeochemistDashboardData {
  total_samples: number;
  pending_samples: number;
  completed_assays: number;
  qc_pass_rate: number;
  samples_by_type: Record<string, number>;
  elements_analyzed: Record<string, number>;
  laboratory_performance: Record<string, number>;
  recent_batches: number;
  average_tat_days: number;
  cost_per_sample: number;
}

interface Sample {
  id: string;
  sample_id: string;
  sample_type: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  sample_date: string;
  collected_by: string;
  laboratory?: string;
  batch_id?: string;
  status: string;
  created_at: string;
}

interface AssayResult {
  id: string;
  sample_id: string;
  element: string;
  value?: number;
  unit: string;
  detection_limit?: number;
  method?: string;
  laboratory: string;
  qc_flag?: string;
  over_limit: boolean;
  analysis_date?: string;
}

export default function Geochemist() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [showAssayForm, setShowAssayForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<GeochemistDashboardData>({
    queryKey: ['geochemist-dashboard', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geochemist/dashboard${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    }
  });

  // Fetch samples
  const { data: samples, isLoading: samplesLoading } = useQuery<Sample[]>({
    queryKey: ['samples', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geochemist/samples${params}`);
      if (!response.ok) throw new Error('Failed to fetch samples');
      return response.json();
    }
  });

  // Fetch assay results
  const { data: assayResults, isLoading: assaysLoading } = useQuery<AssayResult[]>({
    queryKey: ['assay-results', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geochemist/assays${params}`);
      if (!response.ok) throw new Error('Failed to fetch assay results');
      return response.json();
    }
  });

  const handleExport = (type: string) => {
    setExportType(type);
    setShowExportDialog(true);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registered': return 'outline';
      case 'submitted': return 'secondary';
      case 'analyzed': return 'default';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getQCColor = (flag?: string) => {
    switch (flag) {
      case 'pass': return 'default';
      case 'warning': return 'secondary';
      case 'fail': return 'destructive';
      default: return 'outline';
    }
  };

  const getSampleTypeIcon = (type: string) => {
    switch (type) {
      case 'rock': return '🪨';
      case 'soil': return '🌱';
      case 'stream_sediment': return '🏞️';
      case 'drill_core': return '🔧';
      case 'drill_cuttings': return '⚙️';
      default: return '🧪';
    }
  };

  const sampleColumns = [
    {
      accessorKey: 'sample_id',
      header: 'Sample ID'
    },
    {
      accessorKey: 'sample_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <span>{getSampleTypeIcon(row.getValue('sample_type'))}</span>
          <Badge variant="outline">{row.getValue('sample_type')}</Badge>
        </div>
      )
    },
    {
      accessorKey: 'sample_date',
      header: 'Date',
      cell: ({ row }: any) => new Date(row.getValue('sample_date')).toLocaleDateString()
    },
    {
      accessorKey: 'collected_by',
      header: 'Collected By'
    },
    {
      accessorKey: 'laboratory',
      header: 'Laboratory',
      cell: ({ row }: any) => row.getValue('laboratory') || 'Not assigned'
    },
    {
      accessorKey: 'batch_id',
      header: 'Batch',
      cell: ({ row }: any) => row.getValue('batch_id') || 'N/A'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status');
        return <Badge variant={getStatusColor(status)}>{status}</Badge>;
      }
    }
  ];

  const assayColumns = [
    {
      accessorKey: 'sample_id',
      header: 'Sample ID'
    },
    {
      accessorKey: 'element',
      header: 'Element',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('element')}</Badge>
      )
    },
    {
      accessorKey: 'value',
      header: 'Value',
      cell: ({ row }: any) => {
        const value = row.getValue('value');
        const unit = row.original.unit;
        return value !== null ? `${value} ${unit}` : 'Below DL';
      }
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }: any) => row.getValue('method') || 'N/A'
    },
    {
      accessorKey: 'laboratory',
      header: 'Laboratory'
    },
    {
      accessorKey: 'qc_flag',
      header: 'QC',
      cell: ({ row }: any) => {
        const flag = row.getValue('qc_flag');
        return flag ? <Badge variant={getQCColor(flag)}>{flag}</Badge> : <span>-</span>;
      }
    },
    {
      accessorKey: 'over_limit',
      header: 'Over Limit',
      cell: ({ row }: any) => {
        const overLimit = row.getValue('over_limit');
        return overLimit ? (
          <Badge variant="destructive">Yes</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        );
      }
    },
    {
      accessorKey: 'analysis_date',
      header: 'Analysis Date',
      cell: ({ row }: any) => {
        const date = row.getValue('analysis_date');
        return date ? new Date(date).toLocaleDateString() : 'N/A';
      }
    }
  ];

  if (dashboardLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Geochemistry & LIMS</h1>
          <p className="text-muted-foreground">
            Sample registration, assay management, and quality control
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('qaqc_report')}>
            <FileText className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
          <TabsTrigger value="assays">Assays</TabsTrigger>
          <TabsTrigger value="qc">QA/QC</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
                <TestTube className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.total_samples || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.pending_samples || 0} pending analysis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Assays</CardTitle>
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.completed_assays || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.recent_batches || 0} recent batches
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">QC Pass Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(dashboardData?.qc_pass_rate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Quality control performance</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average TAT</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.average_tat_days?.toFixed(1) || 0} days
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(dashboardData?.cost_per_sample || 0)} per sample
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Samples by Type</CardTitle>
                <CardDescription>Distribution of sample types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.samples_by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{getSampleTypeIcon(type)}</span>
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Elements Analyzed</CardTitle>
                <CardDescription>Most frequently analyzed elements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.elements_analyzed || {})
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([element, count]) => (
                    <div key={element} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{element}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Laboratory Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Laboratory Performance</CardTitle>
              <CardDescription>Performance scores by laboratory</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(dashboardData?.laboratory_performance || {}).map(([lab, score]) => (
                  <div key={lab} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{lab}</span>
                      <span>{score.toFixed(1)}%</span>
                    </div>
                    <Progress value={score} className="w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="samples" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Sample Management</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowSampleForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Register Sample
              </Button>
              <Button variant="outline" onClick={() => handleExport('sample_register')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {samplesLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={sampleColumns}
              data={samples || []}
              searchKey="sample_id"
            />
          )}
        </TabsContent>

        <TabsContent value="assays" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Assay Results</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowAssayForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Result
              </Button>
              <Button variant="outline" onClick={() => handleExport('assay_results')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {assaysLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={assayColumns}
              data={assayResults || []}
              searchKey="sample_id"
            />
          )}
        </TabsContent>

        <TabsContent value="qc" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Quality Assurance & Control</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleExport('qc_summary')}>
                <Download className="h-4 w-4 mr-2" />
                Export QC
              </Button>
            </div>
          </div>

          <QCDashboard />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                  onClick={() => handleExport('qaqc_report')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  QA/QC Report
                </CardTitle>
                <CardDescription>
                  Levey-Jennings charts, precision/accuracy analysis, and QC failures
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('anomaly_analysis')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Multi-element Anomaly
                </CardTitle>
                <CardDescription>
                  Element ratio plots and geochemical anomaly analysis
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('lab_performance')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Lab Performance
                </CardTitle>
                <CardDescription>
                  Laboratory TAT analysis and performance metrics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('sample_tracking')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Sample Tracking
                </CardTitle>
                <CardDescription>
                  Chain of custody and sample status tracking
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('batch_summary')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Batch Summary
                </CardTitle>
                <CardDescription>
                  Analytical batch summaries with QC statistics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('detection_limits')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Detection Limits
                </CardTitle>
                <CardDescription>
                  Detection limit analysis and method performance
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms and Dialogs */}
      {showSampleForm && (
        <SampleRegistrationForm
          onClose={() => setShowSampleForm(false)}
          onSuccess={() => {
            setShowSampleForm(false);
            // Refetch data
          }}
        />
      )}

      {showAssayForm && (
        <AssayResultForm
          onClose={() => setShowAssayForm(false)}
          onSuccess={() => {
            setShowAssayForm(false);
            // Refetch data
          }}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          module="geochemist"
          reportType={exportType}
          projectId={selectedProjectId}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}