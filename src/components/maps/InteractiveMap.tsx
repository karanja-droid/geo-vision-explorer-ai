import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Map, 
  Layers, 
  Satellite, 
  Navigation, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  MapPin,
  Mountain,
  Gem
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Set Mapbox access token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapData {
  projects: Array<{
    id: string;
    name: string;
    coordinates: { latitude: number; longitude: number };
    status: string;
    sites_count: number;
  }>;
  sites: Array<{
    id: string;
    name: string;
    coordinates: { latitude: number; longitude: number };
    site_type: string;
    project_id: string;
    deposits_count: number;
  }>;
  deposits: Array<{
    id: string;
    mineral_type: string;
    coordinates: { latitude: number; longitude: number };
    grade: number;
    confidence_level: number;
    site_id: string;
  }>;
}

interface InteractiveMapProps {
  data: MapData;
  selectedLayer?: 'projects' | 'sites' | 'deposits';
  onLayerChange?: (layer: 'projects' | 'sites' | 'deposits') => void;
  onFeatureClick?: (feature: any) => void;
  className?: string;
  height?: number;
}

const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

const LAYER_COLORS = {
  projects: '#3B82F6', // blue
  sites: '#10B981', // green
  deposits: '#8B5CF6', // purple
};

export function InteractiveMap({ 
  data, 
  selectedLayer = 'projects',
  onLayerChange,
  onFeatureClick,
  className,
  height = 500
}: InteractiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite');
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[mapStyle],
      center: [-98.5795, 39.8283], // Center of US
      zoom: 4,
      pitch: 45,
      bearing: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (map.current && isLoaded) {
      map.current.setStyle(MAP_STYLES[mapStyle]);
    }
  }, [mapStyle, isLoaded]);

  // Add data layers
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Remove existing layers and sources
    ['projects', 'sites', 'deposits'].forEach(layer => {
      if (map.current!.getLayer(`${layer}-layer`)) {
        map.current!.removeLayer(`${layer}-layer`);
      }
      if (map.current!.getSource(`${layer}-source`)) {
        map.current!.removeSource(`${layer}-source`);
      }
    });

    // Add projects layer
    if (data.projects.length > 0) {
      const projectsGeoJSON = {
        type: 'FeatureCollection' as const,
        features: data.projects.map(project => ({
          type: 'Feature' as const,
          properties: {
            id: project.id,
            name: project.name,
            status: project.status,
            sites_count: project.sites_count,
            type: 'project',
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [project.coordinates.longitude, project.coordinates.latitude],
          },
        })),
      };

      map.current.addSource('projects-source', {
        type: 'geojson',
        data: projectsGeoJSON,
      });

      map.current.addLayer({
        id: 'projects-layer',
        type: 'circle',
        source: 'projects-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'sites_count'],
            0, 8,
            10, 16,
            50, 24
          ],
          'circle-color': LAYER_COLORS.projects,
          'circle-opacity': selectedLayer === 'projects' ? 0.8 : 0.3,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Add sites layer
    if (data.sites.length > 0) {
      const sitesGeoJSON = {
        type: 'FeatureCollection' as const,
        features: data.sites.map(site => ({
          type: 'Feature' as const,
          properties: {
            id: site.id,
            name: site.name,
            site_type: site.site_type,
            project_id: site.project_id,
            deposits_count: site.deposits_count,
            type: 'site',
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [site.coordinates.longitude, site.coordinates.latitude],
          },
        })),
      };

      map.current.addSource('sites-source', {
        type: 'geojson',
        data: sitesGeoJSON,
      });

      map.current.addLayer({
        id: 'sites-layer',
        type: 'circle',
        source: 'sites-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'deposits_count'],
            0, 6,
            5, 12,
            20, 18
          ],
          'circle-color': LAYER_COLORS.sites,
          'circle-opacity': selectedLayer === 'sites' ? 0.8 : 0.3,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Add deposits layer
    if (data.deposits.length > 0) {
      const depositsGeoJSON = {
        type: 'FeatureCollection' as const,
        features: data.deposits.map(deposit => ({
          type: 'Feature' as const,
          properties: {
            id: deposit.id,
            mineral_type: deposit.mineral_type,
            grade: deposit.grade,
            confidence_level: deposit.confidence_level,
            site_id: deposit.site_id,
            type: 'deposit',
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [deposit.coordinates.longitude, deposit.coordinates.latitude],
          },
        })),
      };

      map.current.addSource('deposits-source', {
        type: 'geojson',
        data: depositsGeoJSON,
      });

      map.current.addLayer({
        id: 'deposits-layer',
        type: 'circle',
        source: 'deposits-source',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'grade'],
            0, 4,
            5, 8,
            20, 14
          ],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'confidence_level'],
            0, '#EF4444',
            50, '#F59E0B',
            100, '#10B981'
          ],
          'circle-opacity': selectedLayer === 'deposits' ? 0.8 : 0.3,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Add click handlers
    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.current!.queryRenderedFeatures(e.point, {
        layers: ['projects-layer', 'sites-layer', 'deposits-layer'],
      });

      if (features.length > 0) {
        const feature = features[0];
        setSelectedFeature(feature.properties);
        onFeatureClick?.(feature.properties);

        // Create popup
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${feature.properties?.name || feature.properties?.mineral_type}</h3>
              <p class="text-sm text-gray-600">Type: ${feature.properties?.type}</p>
              ${feature.properties?.grade ? `<p class="text-sm">Grade: ${feature.properties.grade}%</p>` : ''}
              ${feature.properties?.confidence_level ? `<p class="text-sm">Confidence: ${feature.properties.confidence_level}%</p>` : ''}
            </div>
          `)
          .addTo(map.current!);
      }
    };

    map.current.on('click', handleClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [data, selectedLayer, isLoaded, onFeatureClick]);

  const fitToBounds = useCallback(() => {
    if (!map.current || !data) return;

    const allCoordinates = [
      ...data.projects.map(p => [p.coordinates.longitude, p.coordinates.latitude]),
      ...data.sites.map(s => [s.coordinates.longitude, s.coordinates.latitude]),
      ...data.deposits.map(d => [d.coordinates.longitude, d.coordinates.latitude]),
    ];

    if (allCoordinates.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();
    allCoordinates.forEach(coord => bounds.extend(coord as [number, number]));

    map.current.fitBounds(bounds, { padding: 50 });
  }, [data]);

  const resetView = useCallback(() => {
    if (!map.current) return;
    map.current.flyTo({
      center: [-98.5795, 39.8283],
      zoom: 4,
      pitch: 45,
      bearing: 0,
    });
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Map Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Interactive Geological Map
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {data.projects.length + data.sites.length + data.deposits.length} features
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Layer Selection */}
            <Tabs value={selectedLayer} onValueChange={onLayerChange as any}>
              <TabsList>
                <TabsTrigger value="projects" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Projects ({data.projects.length})
                </TabsTrigger>
                <TabsTrigger value="sites" className="flex items-center gap-1">
                  <Mountain className="h-4 w-4" />
                  Sites ({data.sites.length})
                </TabsTrigger>
                <TabsTrigger value="deposits" className="flex items-center gap-1">
                  <Gem className="h-4 w-4" />
                  Deposits ({data.deposits.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Map Style */}
            <Select value={mapStyle} onValueChange={setMapStyle as any}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="satellite">
                  <div className="flex items-center gap-2">
                    <Satellite className="h-4 w-4" />
                    Satellite
                  </div>
                </SelectItem>
                <SelectItem value="terrain">
                  <div className="flex items-center gap-2">
                    <Mountain className="h-4 w-4" />
                    Terrain
                  </div>
                </SelectItem>
                <SelectItem value="streets">
                  <div className="flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Streets
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Map Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fitToBounds}>
                <ZoomIn className="h-4 w-4 mr-1" />
                Fit All
              </Button>
              <Button variant="outline" size="sm" onClick={resetView}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {/* Map Container */}
          <div 
            ref={mapContainer} 
            className="w-full rounded-lg overflow-hidden border"
            style={{ height: `${height}px` }}
          />

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: LAYER_COLORS.projects }}
              />
              <span>Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: LAYER_COLORS.sites }}
              />
              <span>Sites</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: LAYER_COLORS.deposits }}
              />
              <span>Deposits</span>
            </div>
            <div className="text-gray-500 ml-4">
              • Size indicates quantity/grade • Color indicates confidence/status
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Feature Info */}
      {selectedFeature && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedFeature.name || selectedFeature.mineral_type}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Type:</span> {selectedFeature.type}
              </div>
              {selectedFeature.status && (
                <div>
                  <span className="font-medium">Status:</span> {selectedFeature.status}
                </div>
              )}
              {selectedFeature.site_type && (
                <div>
                  <span className="font-medium">Site Type:</span> {selectedFeature.site_type}
                </div>
              )}
              {selectedFeature.mineral_type && (
                <div>
                  <span className="font-medium">Mineral:</span> {selectedFeature.mineral_type}
                </div>
              )}
              {selectedFeature.grade && (
                <div>
                  <span className="font-medium">Grade:</span> {selectedFeature.grade}%
                </div>
              )}
              {selectedFeature.confidence_level && (
                <div>
                  <span className="font-medium">Confidence:</span> {selectedFeature.confidence_level}%
                </div>
              )}
              {selectedFeature.sites_count && (
                <div>
                  <span className="font-medium">Sites:</span> {selectedFeature.sites_count}
                </div>
              )}
              {selectedFeature.deposits_count && (
                <div>
                  <span className="font-medium">Deposits:</span> {selectedFeature.deposits_count}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default InteractiveMap;