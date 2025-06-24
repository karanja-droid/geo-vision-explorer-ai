
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Satellite, 
  Layers, 
  Calendar, 
  Download, 
  Play,
  Pause,
  RotateCcw,
  Filter
} from "lucide-react";

const GeospatialViewer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState("satellite");

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
      {/* Main Geospatial Viewer */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <Satellite className="w-5 h-5 text-green-400" />
                Advanced Geospatial Analysis
              </CardTitle>
              <CardDescription className="text-slate-400">
                Multi-temporal satellite imagery and terrain analysis
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                <Filter className="w-4 h-4 mr-1" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Time Series Controls */}
          <div className="mb-6 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-slate-300 font-medium">Time Series Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePlayback}
                  className="border-slate-600 text-slate-300"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(0)}
                  className="border-slate-600 text-slate-300"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  {timeSeriesData[currentDate]?.label}
                </span>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  {timeSeriesData[currentDate]?.changes}
                </Badge>
              </div>
              <Slider
                value={[currentDate]}
                onValueChange={(value) => setCurrentDate(value[0])}
                max={timeSeriesData.length - 1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>{timeSeriesData[0]?.label}</span>
                <span>{timeSeriesData[timeSeriesData.length - 1]?.label}</span>
              </div>
            </div>
          </div>

          {/* Main Viewer */}
          <div className="relative w-full h-96 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg border border-slate-600 overflow-hidden">
            {/* Simulated satellite imagery */}
            <div className="absolute inset-0">
              <div className="w-full h-full bg-gradient-to-br from-green-800/30 via-blue-900/50 to-amber-900/40"></div>
              <div className="absolute inset-0 opacity-30">
                <svg className="w-full h-full">
                  <defs>
                    <pattern id="terrain" width="40" height="40" patternUnits="userSpaceOnUse">
                      <circle cx="20" cy="20" r="1" fill="currentColor" opacity="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#terrain)" />
                </svg>
              </div>
            </div>

            {/* Analysis Overlays */}
            <div className="absolute inset-0">
              {/* Mineral signature overlays */}
              <div className="absolute top-1/4 left-1/3 w-16 h-16 bg-yellow-500/40 rounded-full border-2 border-yellow-400 animate-pulse">
                <div className="absolute inset-2 bg-yellow-400/60 rounded-full"></div>
              </div>
              <div className="absolute top-2/3 right-1/4 w-12 h-12 bg-blue-500/40 rounded-full border-2 border-blue-400 animate-pulse">
                <div className="absolute inset-2 bg-blue-400/60 rounded-full"></div>
              </div>
              <div className="absolute bottom-1/4 left-1/4 w-14 h-14 bg-purple-500/40 rounded-full border-2 border-purple-400 animate-pulse">
                <div className="absolute inset-2 bg-purple-400/60 rounded-full"></div>
              </div>
              
              {/* Change detection areas */}
              <div className="absolute top-1/2 right-1/3 w-20 h-16 border-2 border-red-400 border-dashed bg-red-500/20 rounded">
                <div className="absolute -top-6 left-0 text-xs text-red-400 bg-slate-800 px-2 py-1 rounded">
                  Change Detected
                </div>
              </div>
            </div>

            {/* Analysis indicators */}
            <div className="absolute top-4 left-4 space-y-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                Vegetation Index: 0.68
              </Badge>
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                Mineral Confidence: 87%
              </Badge>
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                Change Rate: +12%
              </Badge>
            </div>

            {/* Coordinates display */}
            <div className="absolute bottom-4 right-4 bg-slate-800/80 px-3 py-2 rounded text-xs text-slate-300 backdrop-blur-sm">
              Lat: -23.5505, Lng: -46.6333
            </div>
          </div>

          {/* Analysis Results */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <h4 className="font-medium text-slate-200 mb-2">Vegetation Analysis</h4>
              <p className="text-sm text-slate-400 mb-2">NDVI Index shows healthy vegetation growth</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-400">0.68 (Good)</span>
              </div>
            </div>

            <div className="p-4 bg-slate-700/30 rounded-lg">
              <h4 className="font-medium text-slate-200 mb-2">Mineral Signatures</h4>
              <p className="text-sm text-slate-400 mb-2">3 potential mineral deposits identified</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-yellow-400">High Confidence</span>
              </div>
            </div>

            <div className="p-4 bg-slate-700/30 rounded-lg">
              <h4 className="font-medium text-slate-200 mb-2">Change Detection</h4>
              <p className="text-sm text-slate-400 mb-2">Surface changes over 6-month period</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs text-red-400">12% Increase</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layer Control Panel */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            Layer Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {layers.map((layer) => (
              <div key={layer.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                <span className="text-slate-300 text-sm">{layer.name}</span>
                <Badge 
                  variant={layer.active ? "default" : "secondary"}
                  className={layer.active 
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : "bg-slate-600/50 text-slate-400 border-slate-600"
                  }
                >
                  {layer.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GeospatialViewer;
