
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Zap, Activity, TrendingUp, Satellite, Brain, Users, Shield } from "lucide-react";
import Navigation from "@/components/Navigation";
import InteractiveMap from "@/components/InteractiveMap";
import AIAnalysisPanel from "@/components/AIAnalysisPanel";
import MetricsDashboard from "@/components/MetricsDashboard";
import GeospatialViewer from "@/components/GeospatialViewer";
import RealtimeCollaboration from "@/components/RealtimeCollaboration";

const Index = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-slate-700">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20" />
        <div className="relative px-6 py-16 max-w-7xl mx-auto">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Satellite className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                GeoVisionminer AI
              </h1>
            </div>
            <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              AI-Powered Mineral Exploration Platform combining advanced geospatial analysis, 
              machine learning, and real-time collaboration for the future of mining exploration.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                <Brain className="w-3 h-3 mr-1" />
                AI-Powered
              </Badge>
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                <MapPin className="w-3 h-3 mr-1" />
                Geospatial Analysis
              </Badge>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                <Users className="w-3 h-3 mr-1" />
                Real-time Collaboration
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600">
              Overview
            </TabsTrigger>
            <TabsTrigger value="geospatial" className="data-[state=active]:bg-green-600">
              Geospatial
            </TabsTrigger>
            <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-purple-600">
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="collaboration" className="data-[state=active]:bg-orange-600">
              Collaboration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <MetricsDashboard />
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Recent Exploration Activity
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Latest mineral exploration and analysis results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { location: "Northern Territory, Australia", confidence: 87, mineral: "Gold", status: "High Potential" },
                    { location: "Atacama Desert, Chile", confidence: 92, mineral: "Lithium", status: "Confirmed" },
                    { location: "Pilbara, Australia", confidence: 74, mineral: "Iron Ore", status: "Under Review" }
                  ].map((result, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-200">{result.location}</p>
                        <p className="text-sm text-slate-400">{result.mineral} • {result.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">{result.confidence}%</p>
                        <p className="text-xs text-slate-500">Confidence</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <InteractiveMap />
            </div>
          </TabsContent>

          <TabsContent value="geospatial" className="mt-8">
            <GeospatialViewer />
          </TabsContent>

          <TabsContent value="ai-analysis" className="mt-8">
            <AIAnalysisPanel />
          </TabsContent>

          <TabsContent value="collaboration" className="mt-8">
            <RealtimeCollaboration />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
