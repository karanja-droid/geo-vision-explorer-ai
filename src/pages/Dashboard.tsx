import React, { useState } from 'react';
import MetricsDashboard from '@/components/MetricsDashboard';
import InteractiveMap from '@/components/InteractiveMap';
import { TrialBanner } from '@/components/TrialBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, TrendingUp, Zap, Microscope, Radio, Layers3, BarChart3, AlertTriangle, CheckCircle } from "lucide-react";
import AIAnalysisDashboard from "@/components/ai/AIAnalysisDashboard";
import IoTDashboard from "@/components/iot/IoTDashboard";
import GeologicalModel3DViewer from "@/components/modeling/GeologicalModel3DViewer";
import BusinessIntelligenceDashboard from "@/components/analytics/BusinessIntelligenceDashboard";
import { FeatureFlag, useFeatureFlags } from "@/config/featureFlags";

const Dashboard = () => {
  const [selectedProject] = useState('sample-project-id'); // In real app, this would come from context/props
  const [selectedSite] = useState('sample-site-id');
  const { isEnabled } = useFeatureFlags();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Trial Banner */}
        <TrialBanner />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">GeoVision AI Miner Dashboard</h1>
          <p className="text-slate-400">Advanced geological exploration with AI-powered intelligence</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">AI Analyses Today</p>
                  <p className="text-2xl font-bold text-green-400">24</p>
                </div>
                <Microscope className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active IoT Devices</p>
                  <p className="text-2xl font-bold text-blue-400">18/20</p>
                </div>
                <Radio className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">3D Models</p>
                  <p className="text-2xl font-bold text-purple-400">7</p>
                </div>
                <Layers3 className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Critical Alerts</p>
                  <p className="text-2xl font-bold text-red-400">2</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-800/50 border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
              Overview
            </TabsTrigger>
            <FeatureFlag feature="FEATURE_AI_ANALYSIS">
              <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-slate-700">
                <Microscope className="h-4 w-4 mr-2" />
                AI Analysis
              </TabsTrigger>
            </FeatureFlag>
            <FeatureFlag feature="FEATURE_IOT_MONITORING">
              <TabsTrigger value="iot-monitoring" className="data-[state=active]:bg-slate-700">
                <Radio className="h-4 w-4 mr-2" />
                IoT Monitoring
              </TabsTrigger>
            </FeatureFlag>
            <FeatureFlag feature="FEATURE_3D_MODELING">
              <TabsTrigger value="3d-modeling" className="data-[state=active]:bg-slate-700">
                <Layers3 className="h-4 w-4 mr-2" />
                3D Modeling
              </TabsTrigger>
            </FeatureFlag>
            <FeatureFlag feature="FEATURE_BUSINESS_INTELLIGENCE">
              <TabsTrigger value="analytics" className="data-[state=active]:bg-slate-700">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </FeatureFlag>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Original Overview Content */}
            <div className="mb-8">
              <MetricsDashboard />
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Recent AI Analysis Results
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Latest AI-powered geological discoveries
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">Spectral Analysis Complete</p>
                        <p className="text-xs text-slate-400">North Ridge - Gold mineralization detected</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                        92% confidence
                      </Badge>
                      <p className="text-xs text-slate-400 mt-1">15 min ago</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Microscope className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">Core Sample Analysis</p>
                        <p className="text-xs text-slate-400">Eastern Valley - Copper-bearing veins identified</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        78% confidence
                      </Badge>
                      <p className="text-xs text-slate-400 mt-1">1 hour ago</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">Anomaly Detected</p>
                        <p className="text-xs text-slate-400">Seismic sensor - Unusual activity pattern</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        High Priority
                      </Badge>
                      <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-400" />
                    Interactive Map
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Real-time exploration sites overview
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <InteractiveMap />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <FeatureFlag feature="FEATURE_AI_ANALYSIS">
            <TabsContent value="ai-analysis">
              <div className="bg-slate-800/30 rounded-lg p-6">
                <AIAnalysisDashboard projectId={selectedProject} />
              </div>
            </TabsContent>
          </FeatureFlag>

          <FeatureFlag feature="FEATURE_IOT_MONITORING">
            <TabsContent value="iot-monitoring">
              <div className="bg-slate-800/30 rounded-lg p-6">
                <IoTDashboard siteId={selectedSite} />
              </div>
            </TabsContent>
          </FeatureFlag>

          <FeatureFlag feature="FEATURE_3D_MODELING">
            <TabsContent value="3d-modeling">
              <div className="bg-slate-800/30 rounded-lg p-6">
                <GeologicalModel3DViewer projectId={selectedProject} />
              </div>
            </TabsContent>
          </FeatureFlag>

          <FeatureFlag feature="FEATURE_BUSINESS_INTELLIGENCE">
            <TabsContent value="analytics">
              <div className="bg-slate-800/30 rounded-lg p-6">
                <BusinessIntelligenceDashboard projectId={selectedProject} />
              </div>
            </TabsContent>
          </FeatureFlag>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;