import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download, MapPin, Database } from 'lucide-react';

interface FeatureStoreProps {
  onFeaturesLoaded?: (features: any[]) => void;
}

interface FeatureRequest {
  bbox: string;
  keys?: string;
  scales?: string;
  format: 'json' | 'parquet' | 'csv';
}

interface ComputationRequest {
  aoi: any;
  scales: number[];
  project_id?: string;
}

export const FeatureStore: React.FC<FeatureStoreProps> = ({ onFeaturesLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [features, setFeatures] = useState<any[]>([]);
  const [availableFeatures, setAvailableFeatures] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [bbox, setBbox] = useState('-180,-90,180,90');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedScales, setSelectedScales] = useState<number[]>([1, 3, 5]);
  const [format, setFormat] = useState<'json' | 'parquet' | 'csv'>('json');
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    loadAvailableFeatures();
  }, []);

  const loadAvailableFeatures = async () => {
    try {
      const response = await fetch('/api/v1/features/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAvailableFeatures(data.available_features || []);
      }
    } catch (err) {
      console.error('Failed to load available features:', err);
    }
  };

  const handleGetFeatures = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const params = new URLSearchParams({
        bbox,
        format
      });
      
      if (selectedKeys.length > 0) {
        params.append('keys', selectedKeys.join(','));
      }
      
      if (selectedScales.length > 0) {
        params.append('scales', selectedScales.join(','));
      }

      const response = await fetch(`/api/v1/features?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (format === 'json') {
        const data = await response.json();
        setFeatures(data.features || []);
        setSuccess(`Loaded ${data.summary?.count || 0} features`);
        
        if (onFeaturesLoaded) {
          onFeaturesLoaded(data.features || []);
        }
      } else {
        // Handle binary formats (parquet, csv)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `features.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setSuccess(`Downloaded features as ${format.toUpperCase()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get features');
    } finally {
      setLoading(false);
    }
  };

  const handleComputeFeatures = async () => {
    setComputing(true);
    setError(null);
    setSuccess(null);

    try {
      // Parse bbox to create simple AOI polygon
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      const aoi = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat]
          ]]
        },
        properties: {}
      };

      const computationRequest: ComputationRequest = {
        aoi,
        scales: selectedScales
      };

      const response = await fetch('/api/v1/features/compute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(computationRequest)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setSuccess(`Feature computation started (Task ID: ${data.task_id})`);
      
      // Poll for task completion
      pollTaskStatus(data.task_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start computation');
    } finally {
      setComputing(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/features/compute/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'completed') {
            setSuccess(`Feature computation completed! Created ${data.result?.cells_created || 0} cells with ${data.result?.features_computed || 0} features.`);
            setTaskId(null);
            return;
          } else if (data.status === 'failed') {
            setError(`Feature computation failed: ${data.error || 'Unknown error'}`);
            setTaskId(null);
            return;
          } else if (data.status === 'running') {
            setSuccess(`Feature computation in progress... (Task ID: ${taskId})`);
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setError('Feature computation timed out');
          setTaskId(null);
        }
      } catch (err) {
        console.error('Error polling task status:', err);
        setTaskId(null);
      }
    };

    setTimeout(poll, 5000); // Start polling after 5 seconds
  };

  const handleExportFeatures = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ bbox });
      
      if (selectedKeys.length > 0) {
        params.append('keys', selectedKeys.join(','));
      }
      
      if (selectedScales.length > 0) {
        params.append('scales', selectedScales.join(','));
      }

      const response = await fetch(`/api/v1/features/export?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSuccess(`Features exported to S3: ${data.s3_path}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export features');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Feature Store
          </CardTitle>
          <CardDescription>
            Compute and retrieve multi-scale geological features for mineral exploration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bounding Box Input */}
          <div className="space-y-2">
            <Label htmlFor="bbox">Bounding Box (min_lon,min_lat,max_lon,max_lat)</Label>
            <Input
              id="bbox"
              value={bbox}
              onChange={(e) => setBbox(e.target.value)}
              placeholder="-180,-90,180,90"
            />
          </div>

          {/* Feature Keys Selection */}
          <div className="space-y-2">
            <Label>Feature Keys (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {availableFeatures.slice(0, 10).map((feature) => (
                <Badge
                  key={feature.key}
                  variant={selectedKeys.includes(feature.key) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    if (selectedKeys.includes(feature.key)) {
                      setSelectedKeys(selectedKeys.filter(k => k !== feature.key));
                    } else {
                      setSelectedKeys([...selectedKeys, feature.key]);
                    }
                  }}
                >
                  {feature.key} ({feature.count})
                </Badge>
              ))}
            </div>
            {availableFeatures.length > 10 && (
              <p className="text-sm text-gray-500">
                Showing first 10 features. {availableFeatures.length - 10} more available.
              </p>
            )}
          </div>

          {/* Scales Selection */}
          <div className="space-y-2">
            <Label>Scales (km)</Label>
            <div className="flex gap-2">
              {[1, 3, 5].map((scale) => (
                <Badge
                  key={scale}
                  variant={selectedScales.includes(scale) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    if (selectedScales.includes(scale)) {
                      setSelectedScales(selectedScales.filter(s => s !== scale));
                    } else {
                      setSelectedScales([...selectedScales, scale]);
                    }
                  }}
                >
                  {scale}km
                </Badge>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label htmlFor="format">Output Format</Label>
            <Select value={format} onValueChange={(value: 'json' | 'parquet' | 'csv') => setFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="parquet">Parquet</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGetFeatures} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
              Get Features
            </Button>
            
            <Button onClick={handleComputeFeatures} disabled={computing} variant="outline">
              {computing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
              Compute Features
            </Button>
            
            <Button onClick={handleExportFeatures} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Export to S3
            </Button>
          </div>

          {/* Status Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Task Status */}
          {taskId && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing features... Task ID: {taskId}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Features Summary */}
          {features.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Features Loaded</h4>
              <p className="text-sm text-gray-600">
                {features.length} feature records loaded
              </p>
              {features.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Sample feature keys: {Object.keys(features[0]).filter(k => !['cell_id', 'longitude', 'latitude', 'country', 'province', 'scale'].includes(k)).slice(0, 5).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};