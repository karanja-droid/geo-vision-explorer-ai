import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Layers3, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Download, 
  Settings, 
  Eye, 
  EyeOff,
  Maximize,
  Play,
  Pause
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GeologicalModel3DViewerProps {
  projectId: string;
}

interface GeologicalModel {
  id: string;
  model_name: string;
  model_type: 'ore_body' | 'structural' | 'lithological' | 'grade_shell';
  model_data_url: string;
  model_format: string;
  confidence_level: number;
  created_at: string;
  bounding_box: any;
  resolution: number;
}

interface ModelingParameters {
  interpolationMethod: 'kriging' | 'idw' | 'nearest_neighbor';
  resolution: number;
  confidenceThreshold: number;
  boundingBox: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
}

const GeologicalModel3DViewer: React.FC<GeologicalModel3DViewerProps> = ({ projectId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'cross-section' | 'plan'>('3d');
  const [opacity, setOpacity] = useState([80]);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Fetch 3D geological models
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['geological-models-3d', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geological_models_3d')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GeologicalModel[];
    }
  });

  // Fetch geostatistical analysis
  const { data: geostatAnalysis } = useQuery({
    queryKey: ['geostat-analysis', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('geostatistical_analysis')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Generate new 3D model
  const generateModel = useMutation({
    mutationFn: async (parameters: ModelingParameters) => {
      const { data, error } = await supabase.functions.invoke('3d-geological-modeling', {
        body: {
          projectId,
          modelType: 'ore_body',
          inputData: {
            drillHoles: [], // Would be populated with actual drill hole data
            samples: [],
            geologicalContacts: []
          },
          parameters
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`3D model generated successfully. Confidence: ${(data.statistics.confidenceLevel * 100).toFixed(1)}%`);
      queryClient.invalidateQueries({ queryKey: ['geological-models-3d', projectId] });
    },
    onError: (error) => {
      toast.error(`Model generation failed: ${error.message}`);
    }
  });

  // Initialize 3D viewer (simplified WebGL implementation)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Set canvas size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Basic WebGL setup for 3D rendering
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Render placeholder 3D scene
    renderPlaceholder3DScene(gl);

  }, [selectedModel, opacity, rotation]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const animate = () => {
      setRotation(prev => ({
        ...prev,
        y: (prev.y + 1) % 360
      }));
    };

    const interval = setInterval(animate, 50);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const renderPlaceholder3DScene = (gl: WebGLRenderingContext) => {
    // Simplified 3D rendering - in production this would use Three.js or similar
    const vertices = new Float32Array([
      // Cube vertices for ore body visualization
      -1, -1,  1,  1, -1,  1,  1,  1,  1, -1,  1,  1, // Front face
      -1, -1, -1, -1,  1, -1,  1,  1, -1,  1, -1, -1, // Back face
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Basic vertex shader
    const vertexShaderSource = `
      attribute vec3 position;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Basic fragment shader
    const fragmentShaderSource = `
      precision mediump float;
      uniform float opacity;
      
      void main() {
        gl_FragColor = vec4(0.8, 0.4, 0.2, opacity);
      }
    `;

    // Compile shaders (simplified)
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Set uniforms
    const opacityLocation = gl.getUniformLocation(program, 'opacity');
    gl.uniform1f(opacityLocation, opacity[0] / 100);

    // Draw (simplified)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const handleGenerateModel = () => {
    const parameters: ModelingParameters = {
      interpolationMethod: 'kriging',
      resolution: 10,
      confidenceThreshold: 0.7,
      boundingBox: {
        minX: -1000, minY: -1000, minZ: -500,
        maxX: 1000, maxY: 1000, maxZ: 0
      }
    };

    generateModel.mutate(parameters);
  };

  const toggleLayerVisibility = (layerId: string) => {
    const newVisible = new Set(visibleLayers);
    if (newVisible.has(layerId)) {
      newVisible.delete(layerId);
    } else {
      newVisible.add(layerId);
    }
    setVisibleLayers(newVisible);
  };

  const getModelTypeColor = (type: string) => {
    switch (type) {
      case 'ore_body':
        return 'bg-yellow-500';
      case 'structural':
        return 'bg-red-500';
      case 'lithological':
        return 'bg-blue-500';
      case 'grade_shell':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">3D Geological Modeling</h2>
          <p className="text-muted-foreground">
            Interactive 3D visualization and geological modeling
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateModel}
            disabled={generateModel.isPending}
          >
            <Layers3 className="h-4 w-4 mr-2" />
            {generateModel.isPending ? 'Generating...' : 'Generate Model'}
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 3D Viewer */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>3D Model Viewer</CardTitle>
                  <CardDescription>
                    {selectedModel ? 'Viewing selected model' : 'Select a model to view'}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsAnimating(!isAnimating)}
                  >
                    {isAnimating ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="w-full h-96 border rounded-lg bg-gray-900"
                  style={{ minHeight: '400px' }}
                />
                
                {/* View Mode Controls */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {['3d', 'cross-section', 'plan'].map((mode) => (
                    <Button
                      key={mode}
                      variant={viewMode === mode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode(mode as any)}
                    >
                      {mode.replace('-', ' ').toUpperCase()}
                    </Button>
                  ))}
                </div>

                {/* Opacity Control */}
                <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm rounded-lg p-3 min-w-48">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opacity: {opacity[0]}%</label>
                    <Slider
                      value={opacity}
                      onValueChange={setOpacity}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Model Info */}
                {selectedModel && (
                  <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm rounded-lg p-3">
                    <div className="text-sm space-y-1">
                      <div className="font-medium">Model Statistics</div>
                      <div>Confidence: 85%</div>
                      <div>Resolution: 10m</div>
                      <div>Volume: 1.2M m³</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Model List & Controls */}
        <div className="space-y-4">
          {/* Model Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {modelsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading models...</div>
                ) : models?.map((model) => (
                  <div
                    key={model.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedModel === model.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedModel(model.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getModelTypeColor(model.model_type)}`} />
                        <span className="font-medium text-sm">{model.model_type.replace('_', ' ')}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisibility(model.id);
                        }}
                      >
                        {visibleLayers.has(model.id) ? 
                          <Eye className="h-3 w-3" /> : 
                          <EyeOff className="h-3 w-3" />
                        }
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>Confidence: {(model.confidence_level * 100).toFixed(1)}%</div>
                      <div>Created: {new Date(model.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Properties */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Model Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Interpolation Method</label>
                  <Select defaultValue="kriging">
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kriging">Kriging</SelectItem>
                      <SelectItem value="idw">Inverse Distance Weighting</SelectItem>
                      <SelectItem value="nearest_neighbor">Nearest Neighbor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Resolution (m)</label>
                  <Select defaultValue="10">
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5m (High)</SelectItem>
                      <SelectItem value="10">10m (Medium)</SelectItem>
                      <SelectItem value="25">25m (Low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Confidence Threshold</label>
                  <Slider
                    defaultValue={[70]}
                    max={100}
                    min={50}
                    step={5}
                    className="w-full mt-2"
                  />
                  <div className="text-xs text-muted-foreground mt-1">70%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export as GLTF
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export as OBJ
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export Cross-Section
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Geostatistical Analysis */}
      {geostatAnalysis && geostatAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Geostatistical Analysis</CardTitle>
            <CardDescription>
              Statistical validation and uncertainty quantification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {geostatAnalysis.slice(0, 3).map((analysis) => (
                <div key={analysis.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{analysis.analysis_type.toUpperCase()}</span>
                    <Badge variant="outline">{analysis.target_variable}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Data Points: {analysis.input_data_points}</div>
                    <div>RMSE: {analysis.estimation_variance?.toFixed(4)}</div>
                    <div>Cross-validation: {analysis.cross_validation_results?.crossValidationScore?.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GeologicalModel3DViewer;