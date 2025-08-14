import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MapPin, 
  Target, 
  Camera, 
  Layers,
  TrendingUp,
  Calendar,
  Users,
  FileText,
  Download,
  Plus,
  Filter,
  Map
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/tables/DataTable';
import { LoadingSpinner } from '@/components/ui/loading';
import { InteractiveMap } from '@/components/maps/InteractiveMap';
import { FieldObservationForm } from '@/components/geologist/FieldObservationForm';
import { GeologicalTargetForm } from '@/components/geologist/GeologicalTargetForm';
import { ExportDialog } from '@/components/exports/ExportDialog';

interface GeologistDashboardData {
  total_observations: number;
  recent_observations: number;
  active_targets: number;
  high_priority_targets: number;
  observations_by_type: Record<string, number>;
  targets_by_commodity: Record<string, number>;
  completion_rate: number;
  field_days_this_month: number;
}

interface FieldObservation {
  id: string;
  project_id: string;
  observation_type: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  elevation?: number;
  description: string;
  lithology?: string;
  structure_type?: string;
  strike?: number;
  dip?: number;
  mineralization?: string;
  alteration?: string;
  geologist: string;
  observation_date: string;
  weather_conditions?: string;
  created_at: string;
}

interface GeologicalTarget {
  id: string;
  project_id: string;
  target_name: string;
  target_type: string;
  geometry: any;
  priority: string;
  rationale: string;
  commodity: string;
  confidence_level?: number;
  prospectivity_score?: number;
  status: string;
  assigned_to?: string;
  target_date?: string;
  created_at: string;
}

export default function Geologist() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showObservationForm, setShowObservationForm] = useState(false);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<GeologistDashboardData>({
    queryKey: ['geologist-dashboard', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geologist/dashboard${params}`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    }
  });

  // Fetch field observations
  const { data: observations, isLoading: observationsLoading } = useQuery<FieldObservation[]>({
    queryKey: ['field-observations', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geologist/field-observations${params}`);
      if (!response.ok) throw new Error('Failed to fetch field observations');
      return response.json();
    }
  });

  // Fetch geological targets
  const { data: targets, isLoading: targetsLoading } = useQuery<GeologicalTarget[]>({
    queryKey: ['geological-targets', selectedProjectId],
    queryFn: async () => {
      const params = selectedProjectId ? `?project_id=${selectedProjectId}` : '';
      const response = await fetch(`/api/v1/geologist/targets${params}`);
      if (!response.ok) throw new Error('Failed to fetch geological targets');
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'on_hold': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  const observationColumns = [
    {
      accessorKey: 'observation_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('observation_type')}</Badge>
      )
    },
    {
      accessorKey: 'lithology',
      header: 'Lithology',
      cell: ({ row }: any) => row.getValue('lithology') || 'N/A'
    },
    {
      accessorKey: 'geologist',
      header: 'Geologist'
    },
    {
      accessorKey: 'observation_date',
      header: 'Date',
      cell: ({ row }: any) => new Date(row.getValue('observation_date')).toLocaleDateString()
    },
    {
      accessorKey: 'elevation',
      header: 'Elevation (m)',
      cell: ({ row }: any) => {
        const elevation = row.getValue('elevation');
        return elevation ? `${elevation.toFixed(0)}m` : 'N/A';
      }
    }
  ];

  const targetColumns = [
    {
      accessorKey: 'target_name',
      header: 'Target Name'
    },
    {
      accessorKey: 'target_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline">{row.getValue('target_type')}</Badge>
      )
    },
    {
      accessorKey: 'commodity',
      header: 'Commodity'
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }: any) => {
        const priority = row.getValue('priority');
        return <Badge variant={getPriorityColor(priority)}>{priority}</Badge>;
      }
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
      accessorKey: 'confidence_level',
      header: 'Confidence',
      cell: ({ row }: any) => {
        const confidence = row.getValue('confidence_level');
        return confidence ? formatPercentage(confidence * 100) : 'N/A';
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
          <h1 className="text-3xl font-bold">Geological Operations</h1>
          <p className="text-muted-foreground">
            Field mapping, structural analysis, and target generation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport('geological_mapbook')}>
            <FileText className="h-4 w-4 mr-2" />
            Export Reports
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="observations">Field Data</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="mapping">Mapping</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Field Observations</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.total_observations || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.recent_observations || 0} in last 30 days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Targets</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.active_targets || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData?.high_priority_targets || 0} high priority
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(dashboardData?.completion_rate || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Target completion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Field Days</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData?.field_days_this_month || 0}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Observations by Type</CardTitle>
                <CardDescription>Distribution of field observation types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.observations_by_type || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
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
                <CardTitle>Targets by Commodity</CardTitle>
                <CardDescription>Active targets by commodity type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(dashboardData?.targets_by_commodity || {}).map(([commodity, count]) => (
                    <div key={commodity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{commodity}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="observations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Field Observations</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowObservationForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Observation
              </Button>
              <Button variant="outline" onClick={() => handleExport('field_observations')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {observationsLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={observationColumns}
              data={observations || []}
              searchKey="description"
            />
          )}
        </TabsContent>

        <TabsContent value="targets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Geological Targets</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button onClick={() => setShowTargetForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Target
              </Button>
              <Button variant="outline" onClick={() => handleExport('target_rationale')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {targetsLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={targetColumns}
              data={targets || []}
              searchKey="target_name"
            />
          )}
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Geological Mapping</h2>
            <div className="flex gap-2">
              <Button variant="outline">
                <Layers className="h-4 w-4 mr-2" />
                Layers
              </Button>
              <Button variant="outline" onClick={() => handleExport('geological_map')}>
                <Download className="h-4 w-4 mr-2" />
                Export Map
              </Button>
            </div>
          </div>

          <Card className="h-[600px]">
            <CardContent className="p-0 h-full">
              <InteractiveMap
                observations={observations}
                targets={targets}
                showObservations={true}
                showTargets={true}
                onObservationClick={(obs) => console.log('Observation clicked:', obs)}
                onTargetClick={(target) => console.log('Target clicked:', target)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" 
                  onClick={() => handleExport('geological_mapbook')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  Geological Mapbook
                </CardTitle>
                <CardDescription>
                  Comprehensive geological maps with cross-sections and annotations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('target_rationale')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Target Rationale
                </CardTitle>
                <CardDescription>
                  Detailed target analysis with prospectivity and uncertainty overlays
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('campaign_summary')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Campaign Summary
                </CardTitle>
                <CardDescription>
                  Field campaign results, samples collected, and pending assays
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('structural_analysis')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Structural Analysis
                </CardTitle>
                <CardDescription>
                  Structural measurements, stereonets, and kinematic analysis
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('lithology_log')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Lithology Log
                </CardTitle>
                <CardDescription>
                  Detailed lithological descriptions with field photographs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleExport('alteration_mapping')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Alteration Mapping
                </CardTitle>
                <CardDescription>
                  Hydrothermal alteration zones and mineral assemblages
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Forms and Dialogs */}
      {showObservationForm && (
        <FieldObservationForm
          onClose={() => setShowObservationForm(false)}
          onSuccess={() => {
            setShowObservationForm(false);
            // Refetch data
          }}
        />
      )}

      {showTargetForm && (
        <GeologicalTargetForm
          onClose={() => setShowTargetForm(false)}
          onSuccess={() => {
            setShowTargetForm(false);
            // Refetch data
          }}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          module="geologist"
          reportType={exportType}
          projectId={selectedProjectId}
          onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}