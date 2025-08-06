import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Layers, 
  Satellite,
  Filter
} from "lucide-react";
import { useSites } from '@/hooks/useSites';
import { usePredictions } from '@/hooks/usePredictions';
import { supabase } from '@/integrations/supabase/client';

const MapboxMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { sites } = useSites();
  const { predictions } = usePredictions();

  // Real geological coordinates for mineral sites (Brazilian regions)
  const realCoordinates = [
    { lat: -23.5505, lng: -46.6333 }, // São Paulo region
    { lat: -19.9167, lng: -43.9345 }, // Minas Gerais - Iron Triangle
    { lat: -15.7801, lng: -47.9292 }, // Brasília region
    { lat: -12.9704, lng: -38.5124 }, // Bahia copper region
    { lat: -25.4284, lng: -49.2733 }, // Paraná region
    { lat: -8.0476, lng: -34.8770 },  // Pernambuco region
    { lat: -3.7319, lng: -38.5267 },  // Ceará region
    { lat: -22.9068, lng: -43.1729 }  // Rio de Janeiro region
  ];

  const mineralSites = sites.slice(0, 8).map((site, index) => {
    const sitePredictions = predictions.filter(p => p.site_id === site.id);
    const highestConfidence = sitePredictions.reduce((max, pred) => 
      (pred.confidence_score || 0) > max ? (pred.confidence_score || 0) : max, 0
    );
    
    const confidenceLevel = highestConfidence >= 90 ? "Very High" : 
                           highestConfidence >= 70 ? "High" : "Medium";
    
    return {
      id: site.id,
      name: site.name,
      mineral: sitePredictions[0]?.prediction_data?.mineral_type || "Unknown",
      confidence: confidenceLevel,
      coordinates: realCoordinates[index] || realCoordinates[0]
    };
  });

  const fetchTokenAndInitialize = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      
      if (error) throw error;
      if (!data?.token) throw new Error('No token received');

      mapboxgl.accessToken = data.token;
      initializeMap();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map');
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
      zoom: 6,
      pitch: 45,
      bearing: 0
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add full screen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add mineral sites as markers
    map.current.on('load', () => {
      mineralSites.forEach((site) => {
        const markerColor = site.confidence === "Very High" ? '#10b981' : 
                           site.confidence === "High" ? '#3b82f6' : '#eab308';
        
        // Create custom marker
        const marker = new mapboxgl.Marker({ 
          color: markerColor,
          scale: site.confidence === "Very High" ? 1.2 : 
                 site.confidence === "High" ? 1.0 : 0.8
        })
        .setLngLat([site.coordinates.lng, site.coordinates.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-3">
                <h3 class="font-semibold text-foreground">${site.name}</h3>
                <p class="text-sm text-muted-foreground">${site.mineral}</p>
                <p class="text-sm text-muted-foreground">Confidence: ${site.confidence}</p>
              </div>
            `)
        )
        .addTo(map.current!);
      });
    });

    // Add layer switching capability
    map.current.on('style.load', () => {
      // Add custom layers here if needed
    });
  };

  const switchMapStyle = (style: string) => {
    if (map.current) {
      map.current.setStyle(`mapbox://styles/mapbox/${style}`);
    }
  };

  useEffect(() => {
    fetchTokenAndInitialize();
  }, []);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-foreground">Loading satellite map...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Map Configuration Error</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchTokenAndInitialize} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Satellite Map View
            </h3>
            <p className="text-sm text-muted-foreground">
              Real-time satellite imagery with mineral site overlays
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => switchMapStyle('satellite-v9')}
            >
              <Satellite className="w-4 h-4 mr-1" />
              Satellite
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => switchMapStyle('outdoors-v12')}
            >
              <Layers className="w-4 h-4 mr-1" />
              Terrain
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <div ref={mapContainer} className="w-full h-96" />
          
          {/* Site count overlay */}
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {mineralSites.length} Active Sites
            </Badge>
          </div>
          
          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border border-border">
            <h4 className="text-xs font-medium text-foreground mb-2">Confidence Levels</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs text-muted-foreground">Very High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-muted-foreground">High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-muted-foreground">Medium</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapboxMap;