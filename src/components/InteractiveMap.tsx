
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Satellite,
  Filter,
  MoreVertical
} from "lucide-react";

const InteractiveMap = () => {
  const [selectedLayer, setSelectedLayer] = useState("satellite");
  
  const mineralSites = [
    { id: 1, name: "Site Alpha", lat: 30, lng: 120, mineral: "Gold", confidence: "High", x: "35%", y: "25%" },
    { id: 2, name: "Site Beta", lat: -20, lng: 140, mineral: "Lithium", confidence: "Very High", x: "70%", y: "60%" },
    { id: 3, name: "Site Gamma", lat: 45, lng: 100, mineral: "Copper", confidence: "Medium", x: "25%", y: "15%" },
    { id: 4, name: "Site Delta", lat: -35, lng: 150, mineral: "Iron", confidence: "High", x: "80%", y: "75%" },
  ];

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "Very High": return "bg-green-500";
      case "High": return "bg-blue-500";
      case "Medium": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-400" />
              Interactive Exploration Map
            </CardTitle>
            <CardDescription className="text-slate-400">
              Real-time mineral site analysis and predictions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
              <Layers className="w-4 h-4 mr-1" />
              Layers
            </Button>
            <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Map Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              <Satellite className="w-3 h-3 mr-1" />
              Satellite View
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-400">
              4 Active Sites
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Map Display */}
        <div className="relative w-full h-80 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg border border-slate-600 overflow-hidden">
          {/* Simulated satellite imagery background */}
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full bg-gradient-to-br from-green-900 via-blue-900 to-brown-800"></div>
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-slate-800/30 to-slate-900/50"></div>
          </div>
          
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full">
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Mineral Sites */}
          {mineralSites.map((site) => (
            <div
              key={site.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
              style={{ left: site.x, top: site.y }}
            >
              {/* Site marker */}
              <div className={`w-4 h-4 ${getConfidenceColor(site.confidence)} rounded-full border-2 border-white shadow-lg animate-pulse`}>
                <div className="absolute inset-0 rounded-full bg-white/30 animate-ping"></div>
              </div>
              
              {/* Hover tooltip */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-slate-600 whitespace-nowrap">
                  <div className="font-medium">{site.name}</div>
                  <div className="text-slate-300">{site.mineral} • {site.confidence}</div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                </div>
              </div>

              {/* Confidence ring */}
              <div className="absolute inset-0 rounded-full border border-white/20 animate-pulse" style={{ 
                width: site.confidence === "Very High" ? "24px" : site.confidence === "High" ? "20px" : "16px",
                height: site.confidence === "Very High" ? "24px" : site.confidence === "High" ? "20px" : "16px",
                marginLeft: site.confidence === "Very High" ? "-4px" : site.confidence === "High" ? "-2px" : "0px",
                marginTop: site.confidence === "Very High" ? "-4px" : site.confidence === "High" ? "-2px" : "0px"
              }}></div>
            </div>
          ))}

          {/* Analysis overlay zones */}
          <div className="absolute top-4 right-4 space-y-2">
            {["High Priority", "Under Analysis", "Scheduled"].map((status, i) => (
              <Badge key={i} variant="secondary" className="bg-slate-900/80 text-slate-300 border-slate-600 backdrop-blur-sm">
                {status}
              </Badge>
            ))}
          </div>
        </div>

        {/* Map legend */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-slate-400">Very High Confidence</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-slate-400">High Confidence</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-slate-400">Medium Confidence</span>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Last updated: 2 minutes ago
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractiveMap;
