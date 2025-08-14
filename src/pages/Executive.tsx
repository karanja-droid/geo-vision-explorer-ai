import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Download,
  Plus,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/DataTable';
import { LoadingSpinner } from '@/components/ui/loading';
import { BudgetForm } from '@/components/executive/BudgetForm';
import { ESGSignoffForm } from '@/components/executive/ESGSignoffForm';
import { ExportDialog } from '@/components/exports/ExportDialog';

interface KPIData {
  total_budget: number;
  spent_budget: number;
  budget_utilization: number;
  active_projects: number;
  completed_projects: number;
  pending_esg_signoffs: number;
  high_risk_items: number;
  cost_to_target_ratio: number;
  hit_rate_percentage: number;
  burn_vs_plan_percentage: number;
}

interface Budget {
  id: string;
  project_id: string;
  budget_type: string;
  fiscal_year: number;
  approved_amount: number;
  spent_amount: number;
  currency: string;
  approval_status: string;
  created_at: string;
}

interface ESGSignoff {
  id: string;
  project_id: string;
  esg_category: string;
  requirement_type: string;
  status: string;
  risk_level: string;
  due_date: string;
  created_at: string;
}

export default function Executive() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showESGForm, setShowESGForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<string>('');

  // Fetch KPI data
  const { data: kpiData, isLoading: kpiLoading } = useQuery<KPIData>({
    queryKey: ['executive-kpi'],
    queryFn: async () => {
      const response = await fetch('/api/v1/executive/dashboard/kpi');
      if (!response.ok) throw new Error('Failed to fetch KPI data');
      return response.json();
    }
  });

  // Fetch budgets
  const { data: budgets, isLoading: budgetsLoading } = useQuery<Budget[]>({
    queryKey: ['executive-budgets'],
    queryFn: async () => {
      const response = await fetch('/api/v1/executive/budgets');
      if (!response.ok) throw new Error('Failed to fetch budgets');
      return response.json();
    }
  });

  // Fetch ESG signoffs
  const { data: esgSignoffs, isLoading: esgLoading } = useQuery<ESGSignoff[]>({
    queryKey: ['executive-esg-signoffs'],
    queryFn: async () => {
      const response = await fetch('/api/v1/executive/esg-signoffs');
      if (!response.ok) throw new Error('Failed to fetch ESG signoffs');
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

  const budgetColumns = [
    {
      accessorKey: 'budget_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('budget_type')}</Badge>
      )
    },
    {
      accessorKey: 'fiscal_year',
      header: 'Fiscal Year'
    },
    {
      accessorKey: 'approved_amount',
      header: 'Approved Amount',
      cell: ({ row }: any) => formatCurrency(row.getValue('approved_amount'))
    },
    {
      accessorKey: 'spent_amount',
      header: 'Spent Amount',
      cell: ({ row }: any) => formatCurrency(row.getValue('spent_amount'))
    },
    {
      accessorKey: 'approval_status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('approval_status');
        return (
          <Badge variant={status === 'approved' ? 'default' : 'secondary'}>
            {status}
          </Badge>
        );
      }
    }
  ];

  const esgColumns = [
    {
      accessorKey: 'esg_category',
      header: 'Category',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('esg_category')}</Badge>
      )
    },
    {
      accessorKey: 'requirement_type',
      header: 'Requirement'
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status');
        return (
          <Badge variant={status === 'signed_off' ? 'default' : 'destructive'}>
            {status}
          </Badge>
        );
      }
    },
    {
      accessorKey: 'risk_level',
      header: 'Risk Level',
      cell: ({ row }: any) => {
        const risk = row.getValue('risk_level');
        const variant = risk === 'high' ? 'destructive' : risk === 'medium' ? 'secondary' : 'default';
        return <Badge variant={variant}>{risk}</Badge>;
      }
    },
    {
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }: any) => {
        const date = row.getValue('due_date');
        return date ? new Date(date).toLocaleDateString() : 'N/A';
      }
    }
  ];

  if (kpiLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">
            Portfolio oversight, budget management, and ESG compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('kpi_dashboard')}>
            <FileText className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="esg">ESG Compliance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpiData?.total_budget || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatPercentage(kpiData?.budget_utilization || 0)} utilized
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData?.active_projects || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {kpiData?.completed_projects || 0} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ESG Signoffs</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpiData?.pending_esg_signoffs || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {kpiData?.high_risk_items || 0} high risk items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(kpiData?.hit_rate_percentage || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cost to target: {kpiData?.cost_to_target_ratio?.toFixed(1)}x
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Budget Activity</CardTitle>
                <CardDescription>Latest budget approvals and spending</CardDescription>
              </CardHeader>
              <CardContent>
                {budgetsLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div className="space-y-4">
                    {budgets?.slice(0, 5).map((budget) => (
                      <div key={budget.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{budget.budget_type}</p>
                          <p className="text-sm text-muted-foreground">
                            FY {budget.fiscal_year}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(budget.approved_amount)}
                          </p>
                          <Badge variant={budget.approval_status === 'approved' ? 'default' : 'secondary'}>
                            {budget.approval_status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ESG Compliance Status</CardTitle>
                <CardDescription>Pending signoffs and risk items</CardDescription>
              </CardHeader>
              <CardContent>
                {esgLoading ? (
                  <LoadingSpinner />
                ) : (
                  <div className="space-y-4">
                    {esgSignoffs?.slice(0, 5).map((signoff) => (
                      <div key={signoff.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{signoff.requirement_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {signoff.esg_category}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={signoff.risk_level === 'high' ? 'destructive' : 'secondary'}>
                            {signoff.risk_level}
                          </Badge>
                          <Badge variant={signoff.status === 'signed_off' ? 'default' : 'destructive'}>
                            {signoff.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Budget Management</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowBudgetForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
              <Button variant="outline" onClick={() => handleExport('budget_summary')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {budgetsLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={budgetColumns}
              data={budgets || []}
              searchKey="budget_type"
            />
          )}
        </TabsContent>

        <TabsContent value="esg" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">ESG Compliance</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowESGForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
              <Button variant="outline" onClick={() => handleExport('esg_summary')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {esgLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={esgColumns}
              data={esgSignoffs || []}
              searchKey="requirement_type"
            />
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                  onClick={() => handleExport('kpi_dashboard')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  KPI Dashboard
                </CardTitle>
                <CardDescription>
                  Portfolio performance metrics and key indicators
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('pipeline_status')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Pipeline Status
                </CardTitle>
                <CardDescription>
                  Project pipeline from license to resource
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('esg_summary')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  ESG Summary
                </CardTitle>
                <CardDescription>
                  Environmental, social, and governance compliance
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms and Dialogs */}
      {showBudgetForm && (
        <BudgetForm
          onClose={() => setShowBudgetForm(false)}
          onSuccess={() => {
            setShowBudgetForm(false);
            // Refetch data
          }}
        />
      )}

      {showESGForm && (
        <ESGSignoffForm
          onClose={() => setShowESGForm(false)}
          onSuccess={() => {
            setShowESGForm(false);
            // Refetch data
          }}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          module="executive"
          reportType={exportType}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}