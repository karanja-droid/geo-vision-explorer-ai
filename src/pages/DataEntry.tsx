/**
 * Data Entry Dashboard
 * 
 * Central hub for all geological data entry operations
 * Provides access to different data entry modules and bulk import capabilities
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Database, 
  Map, 
  TestTube, 
  Drill,
  Satellite,
  Plus,
  Import,
  Download,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { DrillCollarForm } from '@/components/drilling/DrillCollarForm';
import { GeochemSampleForm } from '@/components/geochemistry/GeochemSampleForm';

interface DataEntryStats {
  drilling: {
    total_holes: number;
    pending_validation: number;
    completed_today: number;
  };
  geochemistry: {
    total_samples: number;
    pending_analysis: number;
    completed_today: number;
  };
  geology: {
    total_samples: number;
    pending_description: number;
    completed_today: number;
  };
  spatial: {
    total_layers: number;
    pending_processing: number;
    uploaded_today: number;
  };
}

const DataEntry: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DataEntryStats>({
    drilling: {
      total_holes: 145,
      pending_validation: 8,
      completed_today: 12
    },
    geochemistry: {
      total_samples: 2340,
      pending_analysis: 45,
      completed_today: 28
    },
    geology: {
      total_samples: 890,
      pending_description: 15,
      completed_today: 22
    },
    spatial: {
      total_layers: 34,
      pending_processing: 3,
      uploaded_today: 2
    }
  });

  const dataEntryModules = [
    {
      id: 'drilling',
      title: 'Drilling Data',
      description: 'Enter drill hole information, surveys, and assay results',
      icon: Drill,
      color: 'bg-blue-500',
      stats: stats.drilling,
      actions: ['New Drill Hole', 'Import CSV', 'Bulk Upload']
    },
    {
      id: 'geochemistry',
      title: 'Geochemistry & LIMS',
      description: 'Sample collection, laboratory results, and QC data',
      icon: TestTube,
      color: 'bg-green-500',
      stats: stats.geochemistry,
      actions: ['New Sample', 'Lab Results', 'QC Entry']
    },
    {
      id: 'geology',
      title: 'Geological Mapping',
      description: 'Rock samples, structural data, and field observations',
      icon: Map,
      color: 'bg-orange-500',
      stats: stats.geology,
      actions: ['New Rock Sample', 'Structure Data', 'Field Notes']
    },
    {
      id: 'spatial',
      title: 'Spatial Data',
      description: 'GIS layers, satellite imagery, and spatial datasets',
      icon: Satellite,
      color: 'bg-purple-500',
      stats: stats.spatial,
      actions: ['Upload GIS', 'Import Imagery', 'Vector Data']
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'drilling',
      action: 'New drill hole DDH-001 added',
      user: 'John Smith',
      timestamp: '2 minutes ago',
      status: 'completed'
    },
    {
      id: 2,
      type: 'geochemistry',
      action: 'Lab results imported for batch GC-2025-001',
      user: 'Sarah Johnson',
      timestamp: '15 minutes ago',
      status: 'processing'
    },
    {
      id: 3,
      type: 'geology',
      action: '25 rock samples described',
      user: 'Mike Wilson',
      timestamp: '1 hour ago',
      status: 'completed'
    },
    {
      id: 4,
      type: 'spatial',
      action: 'Geological map layer uploaded',
      user: 'Lisa Chen',
      timestamp: '2 hours ago',
      status: 'pending'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8 text-blue-600" />
            Data Entry
          </h1>
          <p className="text-gray-600">
            Enter and manage geological exploration data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button variant="outline">
            <Import className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Quick Entry
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="drilling">Drilling</TabsTrigger>
          <TabsTrigger value="geochemistry">Geochemistry</TabsTrigger>
          <TabsTrigger value="geology">Geology</TabsTrigger>
          <TabsTrigger value="spatial">Spatial</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Data Entry Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dataEntryModules.map((module) => {
              const IconComponent = module.icon;
              return (
                <Card key={module.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${module.color} text-white`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{module.title}</h3>
                        <p className="text-sm text-gray-600 font-normal">
                          {module.description}
                        </p>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {Object.values(module.stats)[0]}
                          </div>
                          <div className="text-xs text-gray-600">Total</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-yellow-600">
                            {Object.values(module.stats)[1]}
                          </div>
                          <div className="text-xs text-gray-600">Pending</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {Object.values(module.stats)[2]}
                          </div>
                          <div className="text-xs text-gray-600">Today</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {module.actions.map((action, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab(module.id)}
                          >
                            {action}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(activity.status)}
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-gray-600">
                          by {activity.user} • {activity.timestamp}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(activity.status)}>
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drilling Tab */}
        <TabsContent value="drilling" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Drill className="h-5 w-5" />
                    New Drill Hole Entry
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DrillCollarForm />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Drill Data CSV
                  </Button>
                  <Button className="w-full" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Database className="h-4 w-4 mr-2" />
                    View All Drill Holes
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Drilling Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Holes</span>
                      <span className="font-semibold">{stats.drilling.total_holes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Pending Validation</span>
                      <span className="font-semibold text-yellow-600">{stats.drilling.pending_validation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Completed Today</span>
                      <span className="font-semibold text-green-600">{stats.drilling.completed_today}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Geochemistry Tab */}
        <TabsContent value="geochemistry" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    New Geochemical Sample
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GeochemSampleForm />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lab Operations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Lab Results
                  </Button>
                  <Button className="w-full" variant="outline">
                    <TestTube className="h-4 w-4 mr-2" />
                    QC Sample Entry
                  </Button>
                  <Button className="w-full" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Chain of Custody
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Sample Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Total Samples</span>
                      <span className="font-semibold">{stats.geochemistry.total_samples}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Pending Analysis</span>
                      <span className="font-semibold text-yellow-600">{stats.geochemistry.pending_analysis}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Completed Today</span>
                      <span className="font-semibold text-green-600">{stats.geochemistry.completed_today}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Geology Tab */}
        <TabsContent value="geology" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="h-5 w-5" />
                Geological Data Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Map className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Geological Mapping Forms</h3>
                <p className="text-gray-600 mb-4">
                  Rock sample collection, structural measurements, and field observations
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Geological Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Spatial Tab */}
        <TabsContent value="spatial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Satellite className="h-5 w-5" />
                Spatial Data Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Satellite className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">GIS Data Upload</h3>
                <p className="text-gray-600 mb-4">
                  Upload shapefiles, GeoJSON, satellite imagery, and other spatial datasets
                </p>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Spatial Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Import Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Import className="h-5 w-5" />
                Bulk Data Import
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Import className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Bulk Import Tools</h3>
                <p className="text-gray-600 mb-4">
                  Import large datasets from CSV, Excel, or database files
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Download Templates
                  </Button>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Bulk Import
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataEntry;