import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Drill, Upload, FileText, Map, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DrillCollarList } from '@/components/drilling/DrillCollarList';
import { DrillCollarForm } from '@/components/drilling/DrillCollarForm';
import { SmartPdfViewer } from '@/components/pdf/AdobePdfViewer';
import { InteractiveMap } from '@/components/maps/InteractiveMap';
import { useContextualHelp } from '@/hooks/useContextualHelp';

interface DrillCollar {
  id: string;
  hole_id: string;
  easting: number;
  northing: number;
  elevation: number;
  total_depth: number;
  azimuth?: number;
  dip?: number;
  drill_date?: string;
  drill_type?: string;
  contractor?: string;
  status: string;
  country_code: string;
  data_classification: string;
  created_at: string;
  updated_at: string;
}

export default function Drilling() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Contextual help
  const { elementRef } = useContextualHelp('drilling-data-management', {
    autoShow: true,
    delay: 3000
  });

  // State
  const [collars, setCollars] = useState<DrillCollar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCollar, setEditingCollar] = useState<DrillCollar | null>(null);
  const [selectedCollar, setSelectedCollar] = useState<DrillCollar | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');

  // Mock data for development
  useEffect(() => {
    const mockCollars: DrillCollar[] = [
      {
        id: '1',
        hole_id: 'DDH001',
        easting: 123.456789,
        northing: -23.456789,
        elevation: 450.5,
        total_depth: 150.0,
        azimuth: 45.0,
        dip: -60.0,
        drill_date: '2024-01-15',
        drill_type: 'DD',
        contractor: 'ABC Drilling Co.',
        status: 'completed',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-10T08:00:00Z',
        updated_at: '2024-01-15T16:30:00Z'
      },
      {
        id: '2',
        hole_id: 'RC002',
        easting: 123.457000,
        northing: -23.457000,
        elevation: 448.2,
        total_depth: 120.0,
        azimuth: 90.0,
        dip: -70.0,
        drill_date: '2024-01-20',
        drill_type: 'RC',
        contractor: 'XYZ Drilling Ltd.',
        status: 'drilling',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-18T09:00:00Z',
        updated_at: '2024-01-20T14:15:00Z'
      },
      {
        id: '3',
        hole_id: 'DDH003',
        easting: 123.458000,
        northing: -23.458000,
        elevation: 452.1,
        total_depth: 200.0,
        drill_type: 'DD',
        contractor: 'ABC Drilling Co.',
        status: 'planned',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-22T10:00:00Z',
        updated_at: '2024-01-22T10:00:00Z'
      }
    ];

    setTimeout(() => {
      setCollars(mockCollars);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const handleAddCollar = () => {
    setEditingCollar(null);
    setShowForm(true);
  };

  const handleEditCollar = (collar: DrillCollar) => {
    setEditingCollar(collar);
    setShowForm(true);
  };

  const handleDeleteCollar = async (collarId: string) => {
    try {
      // API call would go here
      setCollars(collars.filter(c => c.id !== collarId));
      toast({
        title: "Success",
        description: "Drill collar deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete drill collar",
        variant: "destructive"
      });
    }
  };

  const handleViewCollar = (collar: DrillCollar) => {
    setSelectedCollar(collar);
    setActiveTab('details');
  };

  const handleShowOnMap = (collar: DrillCollar) => {
    setSelectedCollar(collar);
    setActiveTab('map');
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingCollar) {
        // Update existing collar
        const updatedCollar = { ...editingCollar, ...data, updated_at: new Date().toISOString() };
        setCollars(collars.map(c => c.id === editingCollar.id ? updatedCollar : c));
        toast({
          title: "Success",
          description: "Drill collar updated successfully"
        });
      } else {
        // Add new collar
        const newCollar: DrillCollar = {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setCollars([...collars, newCollar]);
        toast({
          title: "Success",
          description: "Drill collar added successfully"
        });
      }
      setShowForm(false);
      setEditingCollar(null);
    } catch (error) {
      throw error; // Let the form handle the error
    }
  };

  const handleExport = async (format: string, filters?: any) => {
    try {
      // Mock export - in real app this would call the API
      toast({
        title: "Export Started",
        description: `Exporting drilling data as ${format.toUpperCase()}...`
      });
      
      // Simulate export completion
      setTimeout(() => {
        const mockExportUrl = `https://example.com/exports/drilling_${Date.now()}.${format}`;
        setExportUrl(mockExportUrl);
        setActiveTab('reports');
        
        toast({
          title: "Export Complete",
          description: "Your drilling data export is ready for download"
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export drilling data",
        variant: "destructive"
      });
    }
  };

  const handleImportData = () => {
    // This would open an import dialog
    toast({
      title: "Import Feature",
      description: "Bulk import feature coming soon"
    });
  };

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <DrillCollarForm
          projectId={projectId!}
          orgId="mock-org-id"
          initialData={editingCollar || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingCollar(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Drill className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">Drilling Data Management</h1>
          </div>
          <p className="text-slate-400">
            Manage drill collars, surveys, intervals, and assay data for your exploration project
          </p>
        </div>

        {/* Main Content */}
        <div ref={elementRef} data-help="drilling">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-slate-800 border-slate-700">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <Drill className="w-4 h-4" />
                Collars
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Map View
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Reports
              </TabsTrigger>
            </TabsList>

            {/* Collar List Tab */}
            <TabsContent value="list" className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button
                    onClick={handleImportData}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Import Data
                  </Button>
                </div>
              </div>

              <DrillCollarList
                collars={collars}
                isLoading={isLoading}
                onAdd={handleAddCollar}
                onEdit={handleEditCollar}
                onDelete={handleDeleteCollar}
                onView={handleViewCollar}
                onExport={handleExport}
                onShowOnMap={handleShowOnMap}
              />
            </TabsContent>

            {/* Map View Tab */}
            <TabsContent value="map" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Map className="w-5 h-5" />
                    Drill Collar Locations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-slate-700 rounded-lg flex items-center justify-center">
                    <InteractiveMap
                      markers={collars.map(collar => ({
                        id: collar.id,
                        latitude: collar.northing,
                        longitude: collar.easting,
                        title: collar.hole_id,
                        description: `${collar.drill_type} - ${collar.total_depth}m`,
                        type: 'drill-collar'
                      }))}
                      selectedMarkerId={selectedCollar?.id}
                      onMarkerClick={(markerId) => {
                        const collar = collars.find(c => c.id === markerId);
                        if (collar) setSelectedCollar(collar);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              {selectedCollar ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Drill Hole Details: {selectedCollar.hole_id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Location</h3>
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Easting:</span> {selectedCollar.easting.toFixed(6)}</p>
                          <p><span className="text-slate-400">Northing:</span> {selectedCollar.northing.toFixed(6)}</p>
                          <p><span className="text-slate-400">Elevation:</span> {selectedCollar.elevation.toFixed(1)}m</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Drilling Parameters</h3>
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Total Depth:</span> {selectedCollar.total_depth.toFixed(1)}m</p>
                          <p><span className="text-slate-400">Azimuth:</span> {selectedCollar.azimuth?.toFixed(1) || 'N/A'}°</p>
                          <p><span className="text-slate-400">Dip:</span> {selectedCollar.dip?.toFixed(1) || 'N/A'}°</p>
                          <p><span className="text-slate-400">Type:</span> {selectedCollar.drill_type || 'N/A'}</p>
                          <p><span className="text-slate-400">Status:</span> {selectedCollar.status}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-8 text-center">
                    <p className="text-slate-400">Select a drill collar to view details</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-white">{collars.length}</div>
                    <p className="text-sm text-slate-400">Total Collars</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-white">
                      {collars.reduce((sum, collar) => sum + collar.total_depth, 0).toFixed(0)}m
                    </div>
                    <p className="text-sm text-slate-400">Total Meters</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-white">
                      {collars.filter(c => c.status === 'completed').length}
                    </div>
                    <p className="text-sm text-slate-400">Completed</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-white">
                      {collars.filter(c => c.status === 'drilling').length}
                    </div>
                    <p className="text-sm text-slate-400">In Progress</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Drilling Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-slate-700 rounded-lg flex items-center justify-center">
                    <p className="text-slate-400">Drilling analytics charts will be displayed here</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Drilling Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  {exportUrl ? (
                    <div className="space-y-4">
                      <p className="text-slate-300">Your drilling report is ready:</p>
                      <SmartPdfViewer
                        fileUrl={exportUrl}
                        fileName="drilling_report.pdf"
                        className="h-96"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 mb-4">No reports generated yet</p>
                      <Button
                        onClick={() => handleExport('pdf')}
                        className="flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Generate Drilling Report
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}