/**
 * Spatial Data Upload Component
 * 
 * Handles upload and processing of various spatial data formats
 * including Shapefiles, GeoJSON, KML, and satellite imagery
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Map, 
  Satellite, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Layers,
  MapPin,
  Globe,
  Image
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';

interface SpatialFile {
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface SpatialDataMetadata {
  name: string;
  description: string;
  data_type: string;
  coordinate_system: string;
  extent: {
    min_x: number;
    min_y: number;
    max_x: number;
    max_y: number;
  };
  feature_count?: number;
  attributes: string[];
  tags: string[];
}

const SpatialDataUpload: React.FC = () => {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<SpatialFile[]>([]);
  const [metadata, setMetadata] = useState<SpatialDataMetadata>({
    name: '',
    description: '',
    data_type: '',
    coordinate_system: 'EPSG:4326',
    extent: { min_x: 0, min_y: 0, max_x: 0, max_y: 0 },
    attributes: [],
    tags: []
  });
  const [processing, setProcessing] = useState(false);

  const supportedFormats = [
    {
      type: 'vector',
      name: 'Vector Data',
      formats: ['.shp', '.geojson', '.kml', '.kmz', '.gpkg'],
      description: 'Geological boundaries, sample locations, structural features',
      icon: Map,
      color: 'bg-blue-500'
    },
    {
      type: 'raster',
      name: 'Raster Data',
      formats: ['.tif', '.tiff', '.img', '.jp2'],
      description: 'Satellite imagery, DEMs, geological maps',
      icon: Satellite,
      color: 'bg-green-500'
    },
    {
      type: 'cad',
      name: 'CAD Data',
      formats: ['.dxf', '.dwg'],
      description: 'Engineering drawings, mine plans',
      icon: FileText,
      color: 'bg-orange-500'
    }
  ];

  const dataTypes = [
    'Geological Boundaries',
    'Sample Locations',
    'Drill Hole Collars',
    'Structural Features',
    'Topographic Data',
    'Satellite Imagery',
    'Geological Map',
    'Mine Infrastructure',
    'Environmental Data',
    'Other'
  ];

  const coordinateSystems = [
    'EPSG:4326 (WGS84)',
    'EPSG:3857 (Web Mercator)',
    'EPSG:32733 (UTM Zone 33S)',
    'EPSG:32734 (UTM Zone 34S)',
    'EPSG:32735 (UTM Zone 35S)',
    'EPSG:32736 (UTM Zone 36S)',
    'EPSG:2048 (Hartebeesthoek94)',
    'Custom'
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: SpatialFile[] = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type || getFileType(file.name),
      status: 'pending',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Process files
    newFiles.forEach((file, index) => {
      processFile(file, uploadedFiles.length + index);
    });

  }, [uploadedFiles.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-esri-shape': ['.shp'],
      'application/geo+json': ['.geojson'],
      'application/vnd.google-earth.kml+xml': ['.kml'],
      'application/vnd.google-earth.kmz': ['.kmz'],
      'image/tiff': ['.tif', '.tiff'],
      'image/jp2': ['.jp2'],
      'application/octet-stream': ['.img', '.gpkg']
    },
    maxSize: 100 * 1024 * 1024 // 100MB
  });

  const getFileType = (filename: string): string => {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'shp':
      case 'geojson':
      case 'kml':
      case 'kmz':
      case 'gpkg':
        return 'vector';
      case 'tif':
      case 'tiff':
      case 'img':
      case 'jp2':
        return 'raster';
      case 'dxf':
      case 'dwg':
        return 'cad';
      default:
        return 'unknown';
    }
  };

  const processFile = async (file: SpatialFile, index: number) => {
    try {
      // Update status to processing
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { ...f, status: 'processing' } : f)
      );

      // Mock processing with progress updates
      for (let progress = 0; progress <= 100; progress += 20) {
        setUploadedFiles(prev => 
          prev.map((f, i) => i === index ? { ...f, progress } : f)
        );
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Complete processing
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { ...f, status: 'completed', progress: 100 } : f)
      );

      toast({
        title: "File Processed",
        description: `Successfully processed ${file.name}`,
      });

    } catch (error) {
      setUploadedFiles(prev => 
        prev.map((f, i) => i === index ? { 
          ...f, 
          status: 'error', 
          error: 'Processing failed' 
        } : f)
      );

      toast({
        title: "Processing Error",
        description: `Failed to process ${file.name}`,
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    try {
      // Validate metadata
      if (!metadata.name || !metadata.data_type) {
        toast({
          title: "Validation Error",
          description: "Name and Data Type are required",
          variant: "destructive"
        });
        return;
      }

      // Submit spatial data
      console.log('Submitting spatial data:', { metadata, files: uploadedFiles });

      toast({
        title: "Success",
        description: "Spatial data uploaded successfully",
      });

      // Reset form
      setUploadedFiles([]);
      setMetadata({
        name: '',
        description: '',
        data_type: '',
        coordinate_system: 'EPSG:4326',
        extent: { min_x: 0, min_y: 0, max_x: 0, max_y: 0 },
        attributes: [],
        tags: []
      });

    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to upload spatial data",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Upload className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-blue-600" />
            Spatial Data Upload
          </h2>
          <p className="text-gray-600">
            Upload and manage spatial datasets for your project
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supported Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supported Formats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {supportedFormats.map((format) => {
                const IconComponent = format.icon;
                return (
                  <div key={format.type} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className={`p-2 rounded-lg ${format.color} text-white`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{format.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{format.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {format.formats.map(fmt => (
                          <Badge key={fmt} variant="outline" className="text-xs">
                            {fmt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600">Drop the files here...</p>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">Drag & drop spatial files here</p>
                  <p className="text-gray-600 mb-4">or click to browse files</p>
                  <p className="text-sm text-gray-500">
                    Supports Shapefiles, GeoJSON, KML, GeoTIFF, and more (max 100MB per file)
                  </p>
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="font-semibold">Uploaded Files</h4>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(file.status)}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {file.status === 'processing' && (
                        <Progress value={file.progress} className="w-24" />
                      )}
                      <Badge className={getStatusColor(file.status)}>
                        {file.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Dataset Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataset_name">Dataset Name *</Label>
                <Input
                  id="dataset_name"
                  value={metadata.name}
                  onChange={(e) => setMetadata(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Geological Boundaries 2025"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_type">Data Type *</Label>
                <Select
                  value={metadata.data_type}
                  onValueChange={(value) => setMetadata(prev => ({ ...prev, data_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select data type" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={metadata.description}
                onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the spatial dataset and its contents..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coordinate_system">Coordinate System</Label>
                <Select
                  value={metadata.coordinate_system}
                  onValueChange={(value) => setMetadata(prev => ({ ...prev, coordinate_system: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {coordinateSystems.map(crs => (
                      <SelectItem key={crs} value={crs.split(' ')[0]}>{crs}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="geology, boundaries, 2025"
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                    setMetadata(prev => ({ ...prev, tags }));
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">
            Preview Data
          </Button>
          <Button 
            type="submit" 
            disabled={uploadedFiles.length === 0 || processing || !metadata.name || !metadata.data_type}
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Dataset
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SpatialDataUpload;