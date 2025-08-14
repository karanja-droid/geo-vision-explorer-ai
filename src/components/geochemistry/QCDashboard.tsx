import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  BarChart3,
  FileText,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/DataTable';
import { useToast } from '@/hooks/use-toast';

interface QCResult {
  id: string;
  qc_type: 'standard' | 'blank' | 'duplicate' | 'detection_limit';
  element: string;
  measured_value: number;
  expected_value: number;
  z_score?: number;
  flag: 'pass' | 'warning' | 'fail';
  notes: string;
  created_at: string;
}

interface QCSummary {
  standard: { total: number; pass: number; warning: number; fail: number };
  blank: { total: number; pass: number; warning: number; fail: number };
  duplicate: { total: number; pass: number; warning: number; fail: number };
  detection_limit: { total: number; pass: number; warning: number; fail: number };
}

interface QCDashboardProps {
  batchId: string;
  projectId: string;
  onRunQC: (batchId: string) => Promise<void>;
  onExportReport: (batchId: string) => Promise<void>;
}

export function QCDashboard({ 
  batchId, 
  projectId, 
  onRunQC, 
  onExportReport 
}: QCDashboardProps) {
  const { toast } = useToast();
  const [qcResults, setQcResults] = useState<QCResult[]>([]);
  const [qcSummary, setQcSummary] = useState<QCSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [overallPassRate, setOverallPassRate] = useState(0);

  // Mock data for development
  useEffect(() => {
    const mockQcResults: QCResult[] = [
      {
        id: '1',
        qc_type: 'standard',
        element: 'Au',
        measured_value: 2.15,
        expected_value: 2.10,
        z_score: 0.24,
        flag: 'pass',
        notes: 'Standard check for Au - within control limits',
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        qc_type: 'standard',
        element: 'Cu',
        measured_value: 850,
        expected_value: 800,
        z_score: 2.5,
        flag: 'warning',
        notes: 'Standard check for Cu - approaching warning limit',
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: '3',
        qc_type: 'blank',
        element: 'Au',
        measured_value: 0.05,
        expected_value: 0.0,
        flag: 'pass',
        notes: 'Blank check for Au - acceptable level',
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: '4',
        qc_type: 'duplicate',
        element: 'Au',
        measured_value: 1.85,
        expected_value: 1.92,
        z_score: 3.7, // RPD stored in z_score field
        flag: 'pass',
        notes: 'Duplicate check for Au - RPD: 3.7%',
        created_at: '2024-01-15T10:30:00Z'
      },
      {
        id: '5',
        qc_type: 'standard',
        element: 'Pb',
        measured_value: 45,
        expected_value: 40,
        z_score: 3.2,
        flag: 'fail',
        notes: 'Standard check for Pb - exceeds control limit',
        created_at: '2024-01-15T10:30:00Z'
      }
    ];

    const mockSummary: QCSummary = {
      standard: { total: 8, pass: 6, warning: 1, fail: 1 },
      blank: { total: 4, pass: 4, warning: 0, fail: 0 },
      duplicate: { total: 6, pass: 5, warning: 1, fail: 0 },
      detection_limit: { total: 12, pass: 11, warning: 1, fail: 0 }
    };

    setQcResults(mockQcResults);
    setQcSummary(mockSummary);

    // Calculate overall pass rate
    const totalChecks = Object.values(mockSummary).reduce((sum, type) => sum + type.total, 0);
    const passedChecks = Object.values(mockSummary).reduce((sum, type) => sum + type.pass, 0);
    setOverallPassRate(totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0);
  }, [batchId]);

  const handleRunQC = async () => {
    setIsLoading(true);
    try {
      await onRunQC(batchId);
      toast({
        title: "QC Analysis Complete",
        description: "Quality control analysis has been completed successfully"
      });
    } catch (error) {
      toast({
        title: "QC Analysis Failed",
        description: "Failed to run quality control analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      await onExportReport(batchId);
      toast({
        title: "Report Generated",
        description: "QC report has been generated and is ready for download"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to generate QC report",
        variant: "destructive"
      });
    }
  };

  const getQCTypeIcon = (qcType: string) => {
    switch (qcType) {
      case 'standard':
        return <Shield className="w-4 h-4" />;
      case 'blank':
        return <CheckCircle className="w-4 h-4" />;
      case 'duplicate':
        return <TrendingUp className="w-4 h-4" />;
      case 'detection_limit':
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getFlagBadgeVariant = (flag: string) => {
    switch (flag) {
      case 'pass':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'fail':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getFlagIcon = (flag: string) => {
    switch (flag) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const qcColumns = [
    {
      accessorKey: 'qc_type',
      header: 'QC Type',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          {getQCTypeIcon(row.getValue('qc_type'))}
          <span className="capitalize">{row.getValue('qc_type').replace('_', ' ')}</span>
        </div>
      ),
    },
    {
      accessorKey: 'element',
      header: 'Element',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="font-mono">
          {row.getValue('element')}
        </Badge>
      ),
    },
    {
      accessorKey: 'measured_value',
      header: 'Measured',
      cell: ({ row }: any) => (
        <span className="font-mono">{row.getValue('measured_value')}</span>
      ),
    },
    {
      accessorKey: 'expected_value',
      header: 'Expected',
      cell: ({ row }: any) => (
        <span className="font-mono">{row.getValue('expected_value')}</span>
      ),
    },
    {
      accessorKey: 'z_score',
      header: 'Z-Score/RPD',
      cell: ({ row }: any) => {
        const value = row.getValue('z_score');
        const qcType = row.original.qc_type;
        if (value === null || value === undefined) return 'N/A';
        
        const suffix = qcType === 'duplicate' ? '%' : '';
        return <span className="font-mono">{value.toFixed(2)}{suffix}</span>;
      },
    },
    {
      accessorKey: 'flag',
      header: 'Result',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          {getFlagIcon(row.getValue('flag'))}
          <Badge variant={getFlagBadgeVariant(row.getValue('flag'))}>
            {row.getValue('flag')}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      cell: ({ row }: any) => (
        <span className="text-sm text-gray-600 max-w-xs truncate">
          {row.getValue('notes')}
        </span>
      ),
    },
  ];

  if (!qcSummary) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Loading QC data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Quality Control Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRunQC}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {isLoading ? 'Running QC...' : 'Run QC Analysis'}
          </Button>
          <Button
            onClick={handleExportReport}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overall Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Overall QC Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Pass Rate</span>
              <span className="text-2xl font-bold">{overallPassRate.toFixed(1)}%</span>
            </div>
            <Progress value={overallPassRate} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Pass: {Object.values(qcSummary).reduce((sum, type) => sum + type.pass, 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>Warning: {Object.values(qcSummary).reduce((sum, type) => sum + type.warning, 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span>Fail: {Object.values(qcSummary).reduce((sum, type) => sum + type.fail, 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span>Total: {Object.values(qcSummary).reduce((sum, type) => sum + type.total, 0)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QC Type Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(qcSummary).map(([qcType, summary]) => {
          const passRate = summary.total > 0 ? (summary.pass / summary.total) * 100 : 0;
          
          return (
            <Card key={qcType}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {getQCTypeIcon(qcType)}
                  {qcType.replace('_', ' ').toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pass Rate</span>
                    <span className="font-bold">{passRate.toFixed(0)}%</span>
                  </div>
                  <Progress value={passRate} className="h-2" />
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <div className="text-center">
                      <div className="font-medium text-green-600">{summary.pass}</div>
                      <div className="text-gray-500">Pass</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-yellow-600">{summary.warning}</div>
                      <div className="text-gray-500">Warn</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-red-600">{summary.fail}</div>
                      <div className="text-gray-500">Fail</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Results */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Results</TabsTrigger>
          <TabsTrigger value="standard">Standards</TabsTrigger>
          <TabsTrigger value="blank">Blanks</TabsTrigger>
          <TabsTrigger value="duplicate">Duplicates</TabsTrigger>
          <TabsTrigger value="detection_limit">Detection Limits</TabsTrigger>
          <TabsTrigger value="failures">Failures Only</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All QC Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults}
                emptyMessage="No QC results available"
                emptyDescription="Run QC analysis to see results"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standard">
          <Card>
            <CardHeader>
              <CardTitle>Standard Reference Material Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults.filter(r => r.qc_type === 'standard')}
                emptyMessage="No standard QC results"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blank">
          <Card>
            <CardHeader>
              <CardTitle>Blank Sample Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults.filter(r => r.qc_type === 'blank')}
                emptyMessage="No blank QC results"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplicate">
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Sample Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults.filter(r => r.qc_type === 'duplicate')}
                emptyMessage="No duplicate QC results"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection_limit">
          <Card>
            <CardHeader>
              <CardTitle>Detection Limit Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults.filter(r => r.qc_type === 'detection_limit')}
                emptyMessage="No detection limit QC results"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failures">
          <Card>
            <CardHeader>
              <CardTitle>Failed QC Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={qcColumns}
                data={qcResults.filter(r => r.flag === 'fail')}
                emptyMessage="No failed QC results"
                emptyDescription="All QC checks are passing!"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}