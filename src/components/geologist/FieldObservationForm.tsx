import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, MapPin, Camera, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const fieldObservationSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  country_code: z.string().min(2, 'Country code is required').max(3),
  data_classification: z.string().default('internal'),
  observation_type: z.enum(['outcrop', 'structure', 'lithology', 'alteration', 'mineralization'], {
    required_error: 'Observation type is required'
  }),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).length(2)
  }),
  elevation: z.number().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  lithology: z.string().optional(),
  structure_type: z.string().optional(),
  strike: z.number().min(0).max(360).optional(),
  dip: z.number().min(0).max(90).optional(),
  mineralization: z.string().optional(),
  alteration: z.string().optional(),
  geologist: z.string().min(1, 'Geologist name is required'),
  observation_date: z.string(),
  weather_conditions: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional()
});

type FieldObservationFormData = z.infer<typeof fieldObservationSchema>;

interface FieldObservationFormProps {
  onClose: () => void;
  onSuccess: () => void;
  observationId?: string;
}

interface Project {
  id: string;
  name: string;
  country_code: string;
}

export function FieldObservationForm({ onClose, onSuccess, observationId }: FieldObservationFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FieldObservationFormData>({
    resolver: zodResolver(fieldObservationSchema),
    defaultValues: {
      data_classification: 'internal',
      observation_date: new Date().toISOString().split('T')[0],
      location: {
        type: 'Point',
        coordinates: [0, 0]
      }
    }
  });

  // Fetch projects for dropdown
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/v1/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    }
  });

  // Create field observation mutation
  const createObservationMutation = useMutation({
    mutationFn: async (data: FieldObservationFormData) => {
      const response = await fetch('/api/v1/geologist/field-observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create field observation');
      return response.json();
    },
    onSuccess: async (data) => {
      // Upload photos if any
      if (selectedFiles.length > 0) {
        await uploadPhotos(data.id);
      }
      
      toast({
        title: 'Success',
        description: 'Field observation created successfully'
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const uploadPhotos = async (observationId: string) => {
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`/api/v1/geologist/field-observations/${observationId}/photos`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to upload photos');
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Warning',
        description: 'Observation created but photo upload failed',
        variant: 'destructive'
      });
    }
  };

  const onSubmit = (data: FieldObservationFormData) => {
    createObservationMutation.mutate(data);
  };

  const selectedProject = projects?.find(p => p.id === watch('project_id'));
  const observationType = watch('observation_type');

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue('location', {
            type: 'Point',
            coordinates: [position.coords.longitude, position.coords.latitude]
          });
          if (position.coords.altitude) {
            setValue('elevation', position.coords.altitude);
          }
          toast({
            title: 'Location Updated',
            description: 'GPS coordinates captured successfully'
          });
        },
        (error) => {
          toast({
            title: 'Location Error',
            description: 'Failed to get GPS location',
            variant: 'destructive'
          });
        }
      );
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      toast({
        title: 'Invalid Files',
        description: 'Some files were rejected. Only images under 10MB are allowed.',
        variant: 'destructive'
      });
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Lithology options
  const lithologyOptions = [
    'Granite', 'Granodiorite', 'Diorite', 'Gabbro', 'Peridotite',
    'Rhyolite', 'Andesite', 'Basalt', 'Dacite', 'Trachyte',
    'Sandstone', 'Shale', 'Limestone', 'Dolomite', 'Conglomerate',
    'Quartzite', 'Marble', 'Slate', 'Schist', 'Gneiss',
    'Amphibolite', 'Migmatite', 'Serpentinite', 'Skarn', 'Hornfels'
  ];

  // Structure types
  const structureTypes = [
    'Foliation', 'Bedding', 'Joint', 'Fault', 'Fracture',
    'Vein', 'Dike', 'Sill', 'Lineation', 'Fold axis',
    'Cleavage', 'Schistosity', 'Gneissosity', 'Shear zone'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create Field Observation</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="geological">Geological</TabsTrigger>
                <TabsTrigger value="structural">Structural</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                {/* Project Selection */}
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project *</Label>
                  <Select onValueChange={(value) => {
                    setValue('project_id', value);
                    const project = projects?.find(p => p.id === value);
                    if (project) {
                      setValue('country_code', project.country_code);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} ({project.country_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.project_id && (
                    <p className="text-sm text-red-600">{errors.project_id.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Observation Type */}
                  <div className="space-y-2">
                    <Label htmlFor="observation_type">Observation Type *</Label>
                    <Select onValueChange={(value) => setValue('observation_type', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="outcrop">Outcrop</SelectItem>
                        <SelectItem value="structure">Structure</SelectItem>
                        <SelectItem value="lithology">Lithology</SelectItem>
                        <SelectItem value="alteration">Alteration</SelectItem>
                        <SelectItem value="mineralization">Mineralization</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.observation_type && (
                      <p className="text-sm text-red-600">{errors.observation_type.message}</p>
                    )}
                  </div>

                  {/* Observation Date */}
                  <div className="space-y-2">
                    <Label htmlFor="observation_date">Observation Date *</Label>
                    <Input
                      id="observation_date"
                      type="date"
                      {...register('observation_date')}
                    />
                    {errors.observation_date && (
                      <p className="text-sm text-red-600">{errors.observation_date.message}</p>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label>Location *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Longitude"
                      type="number"
                      step="any"
                      value={watch('location')?.coordinates[0] || ''}
                      onChange={(e) => {
                        const coords = watch('location')?.coordinates || [0, 0];
                        setValue('location', {
                          type: 'Point',
                          coordinates: [parseFloat(e.target.value) || 0, coords[1]]
                        });
                      }}
                    />
                    <Input
                      placeholder="Latitude"
                      type="number"
                      step="any"
                      value={watch('location')?.coordinates[1] || ''}
                      onChange={(e) => {
                        const coords = watch('location')?.coordinates || [0, 0];
                        setValue('location', {
                          type: 'Point',
                          coordinates: [coords[0], parseFloat(e.target.value) || 0]
                        });
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleLocationClick}>
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Elevation */}
                  <div className="space-y-2">
                    <Label htmlFor="elevation">Elevation (m)</Label>
                    <Input
                      id="elevation"
                      type="number"
                      step="0.1"
                      {...register('elevation', { valueAsNumber: true })}
                    />
                  </div>

                  {/* Geologist */}
                  <div className="space-y-2">
                    <Label htmlFor="geologist">Geologist *</Label>
                    <Input
                      id="geologist"
                      placeholder="Geologist name"
                      {...register('geologist')}
                    />
                    {errors.geologist && (
                      <p className="text-sm text-red-600">{errors.geologist.message}</p>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    placeholder="Detailed description of the observation..."
                    {...register('description')}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                {/* Weather Conditions */}
                <div className="space-y-2">
                  <Label htmlFor="weather_conditions">Weather Conditions</Label>
                  <Input
                    id="weather_conditions"
                    placeholder="e.g., Sunny, 25°C, light wind"
                    {...register('weather_conditions')}
                  />
                </div>
              </TabsContent>

              <TabsContent value="geological" className="space-y-4">
                {/* Lithology */}
                <div className="space-y-2">
                  <Label htmlFor="lithology">Lithology</Label>
                  <Select onValueChange={(value) => setValue('lithology', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select lithology" />
                    </SelectTrigger>
                    <SelectContent>
                      {lithologyOptions.map((lithology) => (
                        <SelectItem key={lithology} value={lithology}>
                          {lithology}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mineralization */}
                <div className="space-y-2">
                  <Label htmlFor="mineralization">Mineralization</Label>
                  <Textarea
                    id="mineralization"
                    rows={3}
                    placeholder="Describe any mineralization observed..."
                    {...register('mineralization')}
                  />
                </div>

                {/* Alteration */}
                <div className="space-y-2">
                  <Label htmlFor="alteration">Alteration</Label>
                  <Textarea
                    id="alteration"
                    rows={3}
                    placeholder="Describe any alteration observed..."
                    {...register('alteration')}
                  />
                </div>
              </TabsContent>

              <TabsContent value="structural" className="space-y-4">
                {/* Structure Type */}
                <div className="space-y-2">
                  <Label htmlFor="structure_type">Structure Type</Label>
                  <Select onValueChange={(value) => setValue('structure_type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select structure type" />
                    </SelectTrigger>
                    <SelectContent>
                      {structureTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Strike */}
                  <div className="space-y-2">
                    <Label htmlFor="strike">Strike (°)</Label>
                    <Input
                      id="strike"
                      type="number"
                      min="0"
                      max="360"
                      step="1"
                      placeholder="0-360"
                      {...register('strike', { valueAsNumber: true })}
                    />
                    {errors.strike && (
                      <p className="text-sm text-red-600">{errors.strike.message}</p>
                    )}
                  </div>

                  {/* Dip */}
                  <div className="space-y-2">
                    <Label htmlFor="dip">Dip (°)</Label>
                    <Input
                      id="dip"
                      type="number"
                      min="0"
                      max="90"
                      step="1"
                      placeholder="0-90"
                      {...register('dip', { valueAsNumber: true })}
                    />
                    {errors.dip && (
                      <p className="text-sm text-red-600">{errors.dip.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photos" className="space-y-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Camera className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Upload field photos
                        </span>
                        <span className="mt-1 block text-sm text-gray-500">
                          PNG, JPG, WebP up to 10MB each
                        </span>
                      </label>
                      <input
                        id="photo-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </div>
                    <Button type="button" variant="outline" className="mt-4">
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </Button>
                  </div>

                  {/* Selected Files */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Photos ({selectedFiles.length})</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Observation'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}