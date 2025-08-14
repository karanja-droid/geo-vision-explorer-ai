import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { TestTube, Upload, FileText, Map, BarChart3, Shield, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { GeochemSampleForm } from '@/components/geochemistry/GeochemSampleForm';
import { QCDashboard } from '@/components/geochemistry/QCDashboard';
import { SmartPdfViewer } from '@/components/pdf/AdobePdfViewer';
import { InteractiveMap } from '@/components/maps/InteractiveMap';
import { DataTable } from '@/components/tables/DataTable';
import { useContextualHelp } from '@/hooks/useContextualHelp';

interface GeochemSample {
  id: string;
  sample_id: string;
  sample_type: string;
  easting: number;
  northing: number;
  elevation?: number;
  collection_date?: string;
  collector?: string;
  sample_weight_kg?: number;
  description?: string;
  country_code: string;
  data_classification: string;
  created_at: string;
  updated_at: string;
}

interface COCBatch {
  id: string;
  batch_id: string;
  lab: string;
  submitted_date: string;
  received_date?: string;
  completed_date?: string;
  sample_count: number;
  qc_sample_count: number;
  status: string;
  notes?: string;
}

export default function Geochemistry() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  
  // Contextual help
  const { elementRef } = useContextualHelp('geochemistry-lims', {
    autoShow: true,
    delay: 3000
  });

  // State
  const [samples, setSamples] = useState<GeochemSample[]>([]);
  const [batches, setBatches] = useState<COCBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [editingSample, setEditingSample] = useState<GeochemSample | null>(null);
  const [selectedSample, setSelectedSample] = useState<GeochemSample | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<COCBatch | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'samples');

  // Mock data for development
  useEffect(() => {
    const mockSamples: GeochemSample[] = [
      {
        id: '1',
        sample_id: 'SOIL001',
        sample_type: 'soil',
        easting: 123.456789,
        northing: -23.456789,
        elevation: 450.5,
        collection_date: '2024-01-15',
        collector: 'John Smith',
        sample_weight_kg: 0.5,
        description: 'Surface soil sample from grid point A1',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-10T08:00:00Z',
        updated_at: '2024-01-15T16:30:00Z'
      },
      {
        id: '2',
        sample_id: 'ROCK002',
        sample_type: 'rock',
        easting: 123.457000,
        northing: -23.457000,
        elevation: 448.2,
        collection_date: '2024-01-16',
        collector: 'Jane Doe',
        sample_weight_kg: 1.2,
        description: 'Quartz vein sample with visible mineralization',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-16T09:00:00Z',
        updated_at: '2024-01-16T14:15:00Z'
      },
      {
        id: '3',
        sample_id: 'STREAM003',
        sample_type: 'stream_sediment',
        easting: 123.458000,
        northing: -23.458000,
        elevation: 445.1,
        collection_date: '2024-01-17',
        collector: 'Bob Wilson',
        sample_weight_kg: 0.3,
        description: 'Stream sediment from downstream location',
        country_code: 'AU',
        data_classification: 'internal',
        created_at: '2024-01-17T10:00:00Z',
        updated_at: '2024-01-17T10:00:00Z'
      }
    ];

    const mockBatches: COCBatch[] = [
      {
        id: '1',
        batch_id: 'BATCH001',
        lab: 'ALS Minerals',
        submitted_date: '2024-01-20',
        received_date: '2024-01-22',
        completed_date: '2024-01-25',
        sample_count: 48,
        qc_sample_count: 12,
        status: 'completed',
        notes: 'Standard multi-element analysis package'
      },
      {
        id: '2',
        batch_id: 'BATCH002',
        lab: 'SGS Minerals',
        submitted_date: '2024-01-25',
        received_date: '2024-01-26',
        sample_count: 36,
        qc_sample_count: 9,
        status: 'in_progress',
        notes: 'Fire assay for precious metals'
      }
    ];

    setTimeout(() => {
      setSamples(mockSamples);
      setBatches(mockBatches);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const handleAddSample = () => {
    setEditingSample(null);
    setShowSampleForm(true);
  };

  const handleEditSample = (sample: GeochemSample) => {
    setEditingSample(sample);
    setShowSampleForm(true);
  };

  const handleDeleteSample = async (sampleId: string) => {
    try {
      setSamples(samples.filter(s => s.id !== sampleId));
      toast({
        title: "Success",
        description: "Geochemistry sample deleted successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete geochemistry sample",
        variant: "destructive"
      });
    }
  };

  const handleViewSample = (sample: GeochemSample) => {
    setSelectedSample(sample);
    setActiveTab('details');
  };

  const handleShowOnMap = (sample: GeochemSample) => {
    setSelectedSample(sample);
    setActiveTab('map');
  };

  const handleSampleFormSubmit = async (data: any) => {
    try {
      if (editingSample) {
        const updatedSample = { ...editingSample, ...data, updated_at: new Date().toISOString() };
        setSamples(samples.map(s => s.id === editingSample.id ? updatedSample : s));
        toast({
          title: "Success",
          description: "Geochemistry sample updated successfully"
        });
      } else {
        const newSample: GeochemSample = {
          id: Date.now().toString(),
          ...data,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setSamples([...samples, newSample]);
        toast({
          title: "Success",
          description: "Geochemistry sample added successfully"
        });
      }
      setShowSampleForm(false);
      setEditingSample(null);
    } catch (error) {
      throw error;
    }
  };

  const handleRunQC = async (batchId: string) => {
    // Mock QC analysis
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast({
      title: "QC Analysis Complete",
      description: "Quality control analysis completed successfully"
    });
  };

  const handleExportQCReport = async (batchId: string) => {
    // Mock QC report export
    const mockReportUrl = `https://example.com/qc-reports/batch_${batchId}_qc_report.pdf`;
    setExportUrl(mockReportUrl);
    setActiveTab('reports');
  };

  const handleExport = async (format: string, filters?: any) => {
    try {
      toast({
        title: "Export Started",
        description: `Exporting geochemistry data as ${format.toUpperCase()}...`
      });
      
      setTimeout(() => {
        const mockExportUrl = `https://example.com/exports/geochemistry_${Date.now()}.${format}`;
        setExportUrl(mockExportUrl);
        setActiveTab('reports');
        
        toast({
          title: "Export Complete",
          description: "Your geochemistry data export is ready"
        });
      }, 2000);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export geochemistry data",
        variant: "destructive"
      });
    }
  };

  const handleImportData = () => {
    toast({
      title: "Import Feature",
      description: "Bulk import feature coming soon"
    });
  };

  // Sample table columns
  const sampleColumns = [
    {
      accessorKey: 'sample_id',
      header: 'Sample ID',
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('sample_id')}</div>
      ),
    },
    {
      accessorKey: 'sample_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="capitalize">
          {row.getValue('sample_type').replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'easting',
      header: 'Easting',
      cell: ({ row }: any) => (
        <div className="text-sm font-mono">{row.getValue('easting').toFixed(6)}</div>
      ),
    },
    {
      accessorKey: 'northing',
      header: 'Northing',
      cell: ({ row }: any) => (
        <div className="text-sm font-mono">{row.getValue('northing').toFixed(6)}</div>
      ),
    },
    {
      accessorKey: 'collection_date',
      header: 'Collection Date',
      cell: ({ row }: any) => (
        <div className="text-sm">
          {row.getValue('collection_date') ? 
            new Date(row.getValue('collection_date')).toLocaleDateString() : 
            'N/A'
          }
        </div>
      ),
    },
    {
      accessorKey: 'collector',
      header: 'Collector',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('collector') || 'N/A'}</div>
      ),
    }
  ];

  // Batch table columns
  const batchColumns = [
    {
      accessorKey: 'batch_id',
      header: 'Batch ID',
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('batch_id')}</div>
      ),
    },
    {
      accessorKey: 'lab',
      header: 'Laboratory',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('lab')}</div>
      ),
    },
    {
      accessorKey: 'sample_count',
      header: 'Samples',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('sample_count')}</div>
      ),
    },
    {
      accessorKey: 'qc_sample_count',
      header: 'QC Samples',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('qc_sample_count')}</div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.getValue('status');
        const variant = status === 'completed' ? 'default' : 
                      status === 'in_progress' ? 'secondary' : 'outline';
        return (
          <Badge variant={variant} className="capitalize">
            {status.replace('_', ' ')}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'submitted_date',
      header: 'Submitted',
      cell: ({ row }: any) => (
        <div className="text-sm">
          {new Date(row.getValue('submitted_date')).toLocaleDateString()}
        </div>
      ),
    }
  ];

  if (showSampleForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
        <GeochemSampleForm
          projectId={projectId!}
          orgId="mock-org-id"
          initialData={editingSample || undefined}
          onSubmit={handleSampleFormSubmit}
          onCancel={() => {
            setShowSampleForm(false);
            setEditingSample(null);
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
            <TestTube className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-bold">Geochemistry & LIMS</h1>
          </div>
          <p className="text-slate-400">
            Manage geochemical samples, laboratory results, and quality control for your exploration project
          </p>
        </div>

        {/* Main Content */}
        <div ref={elementRef} data-help="geochemistry">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 bg-slate-800 border-slate-700">
              <TabsTrigger value="samples" className="flex items-center gap-2">
                <TestTube className="w-4 h-4" />
                Samples
              </TabsTrigger>
              <TabsTrigger value="batches" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Batches
              </TabsTrigger>
              <TabsTrigger value="qc" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                QC
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Map
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Reports
              </TabsTrigger>
            </TabsList>

            {/* Samples Tab */}
            <TabsContent value="samples" className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Geochemistry Samples</h2>
                  <Badge variant="secondary">{samples.length}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleImportData}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Import Data
                  </Button>
                  <Button
                    onClick={handleAddSample}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Sample
                  </Button>
                </div>
              </div>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <DataTable
                    columns={sampleColumns}
                    data={samples}
                    isLoading={isLoading}
                    emptyMessage="No geochemistry samples found"
                    emptyDescription="Add your first sample to get started"
                  />
                </CardContent>
              </Card>

              {/* Sample Statistics */}
              {samples.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">{samples.length}</div>
                      <p className="text-sm text-slate-400">Total Samples</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">
                        {new Set(samples.map(s => s.sample_type)).size}
                      </div>
                      <p className="text-sm text-slate-400">Sample Types</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">
                        {new Set(samples.map(s => s.collector).filter(Boolean)).size}
                      </div>
                      <p className="text-sm text-slate-400">Collectors</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">
                        {samples.filter(s => s.collection_date).length}
                      </div>
                      <p className="text-sm text-slate-400">With Dates</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Batches Tab */}
            <TabsContent value="batches" className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Chain of Custody Batches</h2>
                  <Badge variant="secondary">{batches.length}</Badge>
                </div>
                <Button className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Batch
                </Button>
              </div>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <DataTable
                    columns={batchColumns}
                    data={batches}
                    isLoading={isLoading}
                    emptyMessage="No batches found"
                    emptyDescription="Create your first batch to track samples"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* QC Tab */}
            <TabsContent value="qc" className="space-y-6">
              {selectedBatch || batches.length > 0 ? (
                <QCDashboard
                  batchId={selectedBatch?.id || batches[0]?.id || '1'}
                  projectId={projectId!}
                  onRunQC={handleRunQC}
                  onExportReport={handleExportQCReport}
                />
              ) : (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-8 text-center">
                    <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-400 mb-4">No batches available for QC analysis</p>
                    <Button>Create First Batch</Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Map Tab */}
            <TabsContent value="map" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Map className="w-5 h-5" />
                    Sample Locations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-96 bg-slate-700 rounded-lg">
                    <InteractiveMap
                      markers={samples.map(sample => ({
                        id: sample.id,
                        latitude: sample.northing,
                        longitude: sample.easting,
                        title: sample.sample_id,
                        description: `${sample.sample_type} - ${sample.collector || 'Unknown collector'}`,
                        type: 'geochem-sample'
                      }))}
                      selectedMarkerId={selectedSample?.id}
                      onMarkerClick={(markerId) => {
                        const sample = samples.find(s => s.id === markerId);
                        if (sample) setSelectedSample(sample);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              {selectedSample ? (
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">
                      Sample Details: {selectedSample.sample_id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Sample Information</h3>
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Type:</span> {selectedSample.sample_type.replace('_', ' ')}</p>
                          <p><span className="text-slate-400">Collection Date:</span> {selectedSample.collection_date || 'N/A'}</p>
                          <p><span className="text-slate-400">Collector:</span> {selectedSample.collector || 'N/A'}</p>
                          <p><span className="text-slate-400">Weight:</span> {selectedSample.sample_weight_kg ? `${selectedSample.sample_weight_kg} kg` : 'N/A'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Location</h3>
                        <div className="space-y-2">
                          <p><span className="text-slate-400">Easting:</span> {selectedSample.easting.toFixed(6)}</p>
                          <p><span className="text-slate-400">Northing:</span> {selectedSample.northing.toFixed(6)}</p>
                          <p><span className="text-slate-400">Elevation:</span> {selectedSample.elevation ? `${selectedSample.elevation.toFixed(1)}m` : 'N/A'}</p>
                          <p><span className="text-slate-400">Country:</span> {selectedSample.country_code}</p>
                        </div>
                      </div>
                    </div>
                    
                    {selectedSample.description && (
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold mb-2">Description</h3>
                        <p className="text-slate-300">{selectedSample.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-800 border-slate-700">
                  <CardContent className="p-8 text-center">
                    <p className="text-slate-400">Select a sample to view details</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Geochemistry Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  {exportUrl ? (
                    <div className="space-y-4">
                      <p className="text-slate-300">Your geochemistry report is ready:</p>
                      <SmartPdfViewer
                        fileUrl={exportUrl}
                        fileName="geochemistry_report.pdf"
                        className="h-96"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-400 mb-4">No reports generated yet</p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleExport('pdf')}
                          className="flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          Generate Sample Report
                        </Button>
                        <Button
                          onClick={() => handleExportQCReport('1')}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          Generate QC Report
                        </Button>
                      </div>
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