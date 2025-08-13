import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Download, 
  Eye, 
  EyeOff, 
  Layers, 
  Info,
  Palette,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UncertaintyVisualizationProps {
  inferenceResult?: any;
  onLayerToggle?: (layer: string, visible: boolean) => void;
  onOpacityChange?: (layer: string, opacity: number) => void;
}

interface LayerConfig {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  colorRamp: any;
  statistics?: any;
}

export const UncertaintyVisualization: React.FC<UncertaintyVisualizationProps> = ({
  inferenceResult,
  onLayerToggle,
  onOpacityChange
}) => {
  const [layers, setLayers] = useState<LayerConfig[]>([]);
  const [syncOpacity, setSyncOpacity] = useState(true);
  const [showStatistics, setShowStatistics] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'pdf'>('png');
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (inferenceResult) {
      initializeLayers();
    }
  }, [inferenceResult]);

  const initializeLayers = () => {
    if (!inferenceResult?.metadata) return;

    const colorRamps = inferenceResult.metadata.color_ramps;
    const statistics = inferenceResult.statistics;

    const newLayers: LayerConfig[] = [
      {
        id: 'prospectivity',
        name: 'Prospectivity',
        visible: true,
        opacity: 0.8,
        colorRamp: colorRamps.prospectivity,
        statistics: statistics.prospectivity
      },
      {
        id: 'uncertainty',
        name: 'Uncertainty',
        visible: false,
        opacity: 0.8,
        colorRamp: colorRamps.uncertainty,
        statistics: statistics.uncertainty
      }
    ];

    setLayers(newLayers);
  };

  const handleLayerVisibilityToggle = (layerId: string) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        const newVisible = !layer.visible;
        if (onLayerToggle) {
          onLayerToggle(layerId, newVisible);
        }
        return { ...layer, visible: newVisible };
      }
      return layer;
    }));
  };

  const handleOpacityChange = (layerId: string, newOpacity: number) => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        if (onOpacityChange) {
          onOpacityChange(layerId, newOpacity / 100);
        }
        return { ...layer, opacity: newOpacity / 100 };
      }
      // Sync opacity if enabled
      if (syncOpacity && layer.id !== layerId) {
        if (onOpacityChange) {
          onOpacityChange(layer.id, newOpacity / 100);
        }
        return { ...layer, opacity: newOpacity / 100 };
      }
      return layer;
    }));
  };

  const exportVisualization = async () => {
    setExporting(true);
    try {
      // Create a canvas for export
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');

      // Draw legend and layers
      await drawExportCanvas(canvas);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `prospectivity_uncertainty_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }, `image/${exportFormat}`);

      toast({
        title: "Export successful",
        description: `Visualization exported as ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export visualization",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const drawExportCanvas = async (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 1200;
    canvas.height = 800;

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Prospectivity & Uncertainty Analysis', canvas.width / 2, 40);

    // Draw inference metadata
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Inference ID: ${inferenceResult?.inference_id}`, 50, 80);
    ctx.fillText(`Model Version: ${inferenceResult?.metadata?.model_version}`, 50, 100);
    ctx.fillText(`Generated: ${new Date(inferenceResult?.metadata?.created_at).toLocaleString()}`, 50, 120);

    // Draw legends
    drawLegend(ctx, layers[0], 50, 160, 'Prospectivity');
    drawLegend(ctx, layers[1], 350, 160, 'Uncertainty');

    // Draw statistics if enabled
    if (showStatistics) {
      drawStatistics(ctx, 650, 160);
    }
  };

  const drawLegend = (
    ctx: CanvasRenderingContext2D, 
    layer: LayerConfig, 
    x: number, 
    y: number, 
    title: string
  ) => {
    if (!layer?.colorRamp) return;

    const legendWidth = 200;
    const legendHeight = 20;
    const colorRamp = layer.colorRamp;

    // Draw title
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(title, x, y);

    // Draw color bar
    const gradient = ctx.createLinearGradient(x, y + 20, x + legendWidth, y + 20);
    colorRamp.colors.forEach((color: string, index: number) => {
      gradient.addColorStop(index / (colorRamp.colors.length - 1), color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y + 25, legendWidth, legendHeight);

    // Draw border
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(x, y + 25, legendWidth, legendHeight);

    // Draw labels
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.fillText(colorRamp.min.toFixed(2), x, y + 60);
    ctx.textAlign = 'right';
    ctx.fillText(colorRamp.max.toFixed(2), x + legendWidth, y + 60);
    ctx.textAlign = 'center';
    ctx.fillText(((colorRamp.min + colorRamp.max) / 2).toFixed(2), x + legendWidth / 2, y + 60);
    ctx.textAlign = 'left';
  };

  const drawStatistics = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Statistics', x, y);

    let currentY = y + 25;
    layers.forEach(layer => {
      if (layer.statistics) {
        ctx.font = 'bold 14px Arial';
        ctx.fillText(layer.name, x, currentY);
        currentY += 20;

        ctx.font = '12px Arial';
        ctx.fillText(`Mean: ${layer.statistics.mean.toFixed(3)}`, x, currentY);
        currentY += 15;
        ctx.fillText(`Std: ${layer.statistics.std.toFixed(3)}`, x, currentY);
        currentY += 15;
        ctx.fillText(`Min: ${layer.statistics.min.toFixed(3)}`, x, currentY);
        currentY += 15;
        ctx.fillText(`Max: ${layer.statistics.max.toFixed(3)}`, x, currentY);
        currentY += 25;
      }
    });
  };

  if (!inferenceResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Uncertainty Visualization
          </CardTitle>
          <CardDescription>
            Run AI inference to visualize prospectivity and uncertainty layers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No inference results available. Please run AI inference first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Uncertainty Visualization
          </CardTitle>
          <CardDescription>
            Control prospectivity and uncertainty layer visibility and opacity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Layer Controls */}
          <div className="space-y-4">
            {layers.map(layer => (
              <div key={layer.id} className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={layer.visible}
                      onCheckedChange={() => handleLayerVisibilityToggle(layer.id)}
                    />
                    <Label className="font-medium">{layer.name}</Label>
                    <Badge variant={layer.visible ? "default" : "outline"}>
                      {layer.visible ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLayerVisibilityToggle(layer.id)}
                  >
                    {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </div>

                {layer.visible && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Opacity</Label>
                      <span className="text-sm text-gray-500">
                        {Math.round(layer.opacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[layer.opacity * 100]}
                      onValueChange={(value) => handleOpacityChange(layer.id, value[0])}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Color Ramp Preview */}
                {layer.colorRamp && (
                  <div className="space-y-2">
                    <Label className="text-sm">Color Ramp</Label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-4 w-32 rounded border"
                        style={{
                          background: `linear-gradient(to right, ${layer.colorRamp.colors.join(', ')})`
                        }}
                      />
                      <span className="text-xs text-gray-500">
                        {layer.colorRamp.min.toFixed(2)} - {layer.colorRamp.max.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Global Controls */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>Synchronized Opacity</Label>
              <Switch
                checked={syncOpacity}
                onCheckedChange={setSyncOpacity}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Statistics</Label>
              <Switch
                checked={showStatistics}
                onCheckedChange={setShowStatistics}
              />
            </div>
          </div>

          {/* Statistics Panel */}
          {showStatistics && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <Label className="font-medium">Layer Statistics</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {layers.map(layer => (
                  layer.statistics && (
                    <div key={layer.id} className="space-y-2">
                      <Label className="font-medium">{layer.name}</Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Mean: {layer.statistics.mean.toFixed(3)}</div>
                        <div>Std: {layer.statistics.std.toFixed(3)}</div>
                        <div>Min: {layer.statistics.min.toFixed(3)}</div>
                        <div>Max: {layer.statistics.max.toFixed(3)}</div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Export Controls */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Label>Export Format:</Label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'png' | 'pdf')}
                className="px-2 py-1 border rounded"
              >
                <option value="png">PNG</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            
            <Button
              onClick={exportVisualization}
              disabled={exporting}
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Visualization
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden canvas for export */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={1200}
        height={800}
      />
    </div>
  );
};