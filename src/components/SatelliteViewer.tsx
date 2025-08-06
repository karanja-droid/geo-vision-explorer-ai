import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
import { useMineralDeposits } from '@/hooks/useMineralDeposits';
import { usePredictions } from '@/hooks/usePredictions';
import { supabase } from '@/integrations/supabase/client';

const SatelliteViewer = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDate, setCurrentDate] = useState(0);
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

  const satelliteStyles = [
    { id: 'satellite-v9', name: 'Satellite', description: 'High-resolution satellite imagery' },
    { id: 'satellite-streets-v12', name: 'Satellite + Roads', description: 'Satellite with road overlays' },
    { id: 'outdoors-v12', name: 'Terrain', description: 'Topographic terrain view' },
    { id: 'light-v11', name: 'Light', description: 'Clean vector map' }
  ];

  const fetchTokenAndInitialize = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) throw error;
      if (!data?.token) throw new Error('No token received');

      mapboxgl.accessToken = data.token;
      initializeMap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load satellite viewer');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeMap = () => {
    if (!mapContainer.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-46.6333, -23.5505], // Center on São Paulo, Brazil
      zoom: 8,
      pitch: 60,
      bearing: 0
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add sample mineral analysis overlays
    map.current.on('load', () => {
      // Add heat map layer for mineral signatures
      map.current!.addSource('mineral-heat', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-46.6333, -23.5505]
              },
              properties: { intensity: 0.8, mineral: 'iron' }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-46.5333, -23.4505]
              },
              properties: { intensity: 0.6, mineral: 'copper' }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-46.7333, -23.6505]
              },
              properties: { intensity: 0.9, mineral: 'gold' }
            }
          ]
        }
      });

      map.current!.addLayer({
        id: 'mineral-signatures',
        type: 'circle',
        source: 'mineral-heat',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0, 10, 1, 30],
          'circle-color': [
            'case',
            ['==', ['get', 'mineral'], 'iron'], '#ef4444',
            ['==', ['get', 'mineral'], 'copper'], '#f97316',
            ['==', ['get', 'mineral'], 'gold'], '#eab308',
            '#6b7280'
          ],
          'circle-opacity': 0.6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Add click handlers for mineral signatures
      map.current!.on('click', 'mineral-signatures', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const coordinates = (feature.geometry as any).coordinates.slice();
          const { mineral, intensity } = feature.properties!;
          
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-3">
                <h3 class="font-semibold">Mineral Signature Detected</h3>
                <p class="text-sm">Type: ${mineral}</p>
                <p class="text-sm">Confidence: ${Math.round(intensity * 100)}%</p>
              </div>
            `)
            .addTo(map.current!);
        }
      });

      map.current!.on('mouseenter', 'mineral-signatures', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mouseleave', 'mineral-signatures', () => {
        map.current!.getCanvas().style.cursor = '';
      });
    });
  };

  const switchSatelliteStyle = (styleId: string) => {
    if (map.current) {
      map.current.setStyle(`mapbox://styles/mapbox/${styleId}`);
    }
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  // Auto-advance time series when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentDate(prev => (prev + 1) % timeSeriesData.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeSeriesData.length]);

  useEffect(() => {
    fetchTokenAndInitialize();
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Loading Satellite Analysis...</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-muted-foreground">Initializing satellite viewer</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Satellite Configuration Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchTokenAndInitialize} variant="outline">
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Satellite className="w-5 h-5 text-primary" />
              Advanced Geospatial Analysis
            </CardTitle>
            <CardDescription>
              Multi-temporal satellite imagery and terrain analysis
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time Series Controls */}
        <div className="p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-foreground font-medium">Time Series Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePlayback}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(0)}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {timeSeriesData[currentDate]?.label}
              </span>
              <Badge variant="secondary">
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{timeSeriesData[0]?.label}</span>
              <span>{timeSeriesData[timeSeriesData.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        {/* Satellite Style Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {satelliteStyles.map((style) => (
            <Button
              key={style.id}
              variant="outline"
              size="sm"
              onClick={() => switchSatelliteStyle(style.id)}
              className="flex flex-col h-auto p-3"
            >
              <span className="font-medium">{style.name}</span>
              <span className="text-xs text-muted-foreground">{style.description}</span>
            </Button>
          ))}
        </div>

        {/* Main Satellite Viewer */}
        <div className="relative">
          <div ref={mapContainer} className="w-full h-96 rounded-lg overflow-hidden border border-border" />
          
          {/* Analysis indicators overlay */}
          <div className="absolute top-4 left-4 space-y-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              Vegetation Index: 0.68
            </Badge>
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              Mineral Confidence: {predictionStats.avgConfidence}%
            </Badge>
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              Change Rate: +12%
            </Badge>
          </div>

          {/* Coordinates display */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-2 rounded text-xs text-muted-foreground border border-border">
            Lat: -23.5505, Lng: -46.6333
          </div>
        </div>

        {/* Analysis Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">Vegetation Analysis</h4>
            <p className="text-sm text-muted-foreground mb-2">NDVI Index shows healthy vegetation growth</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-xs text-green-600">0.68 (Good)</span>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">Mineral Signatures</h4>
            <p className="text-sm text-muted-foreground mb-2">{depositStats.totalDeposits} potential mineral deposits identified</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-xs text-yellow-600">{depositStats.avgConfidence}% Avg Confidence</span>
            </div>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">Change Detection</h4>
            <p className="text-sm text-muted-foreground mb-2">Surface changes over 6-month period</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-red-600">12% Increase</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SatelliteViewer;