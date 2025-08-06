
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Satellite, 
  Layers, 
  Calendar, 
  Download, 
  Play,
  Pause,
  RotateCcw,
  Filter,
  Map,
  BarChart3
} from "lucide-react";
import { useMineralDeposits } from '@/hooks/useMineralDeposits';
import { usePredictions } from '@/hooks/usePredictions';
import InteractiveMap from './InteractiveMap';
import EnhancedMetrics from './EnhancedMetrics';
import SatelliteViewer from './SatelliteViewer';

const GeospatialViewer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState("satellite");
  const { getDepositStats } = useMineralDeposits();
  const { getPredictionStats } = usePredictions();

  const depositStats = getDepositStats();
  const predictionStats = getPredictionStats();

  const timeSeriesData = [
    { date: "2024-01", label: "Jan 2024", changes: "Baseline" },
    { date: "2024-02", label: "Feb 2024", changes: "Vegetation Growth" },
    { date: "2024-03", label: "Mar 2024", changes: "Dry Season Onset" },
    { date: "2024-04", label: "Apr 2024", changes: "Mining Activity" },
    { date: "2024-05", label: "May 2024", changes: "Expansion Detected" },
    { date: "2024-06", label: "Jun 2024", changes: "Current State" }
  ];

  const layers = [
    { id: "satellite", name: "Satellite Imagery", active: true },
    { id: "terrain", name: "Terrain Analysis", active: false },
    { id: "vegetation", name: "Vegetation Index", active: false },
    { id: "mineral", name: "Mineral Signatures", active: true },
    { id: "geological", name: "Geological Survey", active: false }
  ];

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="satellite" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border-slate-700">
          <TabsTrigger 
            value="satellite" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <Satellite className="w-4 h-4" />
            Satellite Analysis
          </TabsTrigger>
          <TabsTrigger 
            value="map" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <Map className="w-4 h-4" />
            Interactive Map
          </TabsTrigger>
          <TabsTrigger 
            value="metrics" 
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="satellite" className="mt-6">
          <SatelliteViewer />
        </TabsContent>

        <TabsContent value="map" className="mt-6">
          <InteractiveMap />
        </TabsContent>

        <TabsContent value="metrics" className="mt-6">
          <EnhancedMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GeospatialViewer;
