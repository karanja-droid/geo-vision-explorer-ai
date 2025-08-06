import React from 'react';
import MetricsDashboard from '@/components/MetricsDashboard';
import InteractiveMap from '@/components/InteractiveMap';
import { TrialBanner } from '@/components/TrialBanner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Zap } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Trial Banner */}
        <TrialBanner />
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Overview</h1>
          <p className="text-slate-400">Monitor your geological exploration activities</p>
        </div>

        {/* Metrics Dashboard */}
        <div className="mb-8">
          <MetricsDashboard />
        </div>

        {/* Recent Activity */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Recent Exploration Activity
              </CardTitle>
              <CardDescription className="text-slate-400">
                Latest discoveries and analysis results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">North Ridge Site</p>
                    <p className="text-xs text-slate-400">Gold deposit analysis</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                    85% confidence
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">Eastern Valley</p>
                    <p className="text-xs text-slate-400">Copper deposit potential</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    72% confidence
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">5 hours ago</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">AI Model Update</p>
                    <p className="text-xs text-slate-400">Enhanced prediction accuracy</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    New Model
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">1 day ago</p>
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
      </div>
    </div>
  );
};

export default Dashboard;