import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Target, MapPin, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

const geologicalTargetSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  country_code: z.string().min(2, 'Country code is required').max(3),
  data_classification: z.string().default('internal'),
  target_name: z.string().min(1, 'Target name is required').max(100),
  target_type: z.enum(['drill', 'geophysics', 'geochemistry', 'mapping'], {
    required_error: 'Target type is required'
  }),
  geometry: z.object({
    type: z.enum(['Point', 'Polygon']),
    coordinates: z.any()
  }),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  rationale: z.string().min(20, 'Rationale must be at least 20 characters'),
  commodity: z.string().min(1, 'Commodity is required').max(50),
  confidence_level: z.number().min(0).max(1).optional(),
  prospectivity_score: z.number().min(0).max(1).optional(),
  assigned_to: z.string().uuid().optional(),
  target_date: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional()
});

type GeologicalTargetFormData = z.infer<typeof geologicalTargetSchema>;

interface GeologicalTargetFormProps {
  onClose: () => void;
  onSuccess: () => void;
  targetId?: string;
}

interface Project {
  id: string;
  name: string;
  country_code: string;
}

interface User {
  id: string;
  name: string;
  role: string;
}

export function GeologicalTargetForm({ onClose, onSuccess, targetId }: GeologicalTargetFormProps) {
  const { toast } = useToast();
  const [geometryType, setGeometryType] = useState<'Point' | 'Polygon'>('Point');
  const [confidenceLevel, setConfidenceLevel] = useState([0.5]);
  const [prospectivityScore, setProspectivityScore] = useState([0.5]);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<GeologicalTargetFormData>({
    resolver: zodResolver(geologicalTargetSchema),
    defaultValues: {
      data_classification: 'internal',
      priority: 'medium',
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      },
      confidence_level: 0.5,
      prospectivity_score: 0.5
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

  // Fetch team members for assignment
  const { data: teamMembers } = useQuery<User[]>({
    queryKey: ['team-members'],
    queryFn: async () => {
      const response = await fetch('/api/v1/users/team');
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    }
  });

  // Create geological target mutation
  const createTargetMutation = useMutation({
    mutationFn: async (data: GeologicalTargetFormData) => {
      const response = await fetch('/api/v1/geologist/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create geological target');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Geological target created successfully'
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

  const onSubmit = (data: GeologicalTargetFormData) => {
    // Update confidence and prospectivity scores from sliders
    data.confidence_level = confidenceLevel[0];
    data.prospectivity_score = prospectivityScore[0];
    
    createTargetMutation.mutate(data);
  };

  const selectedProject = projects?.find(p => p.id === watch('project_id'));

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue('geometry', {
            type: geometryType,
            coordinates: geometryType === 'Point' 
              ? [position.coords.longitude, position.coords.latitude]
              : [[[position.coords.longitude, position.coords.latitude]]]
          });
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

  // Commodity options
  const commodityOptions = [
    'Gold', 'Silver', 'Copper', 'Lead', 'Zinc', 'Nickel', 'Platinum', 'Palladium',
    'Iron', 'Aluminum', 'Tin', 'Tungsten', 'Molybdenum', 'Uranium', 'Lithium',
    'Cobalt', 'Rare Earth Elements', 'Diamond', 'Coal', 'Oil & Gas'
  ];

  // Target type descriptions
  const targetTypeDescriptions = {
    drill: 'Drilling target for core sampling and subsurface investigation',
    geophysics: 'Geophysical survey target for anomaly investigation',
    geochemistry: 'Geochemical sampling target for element analysis',
    mapping: 'Geological mapping target for detailed surface study'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Create Geological Target
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
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
                {/* Target Name */}
                <div className="space-y-2">
                  <Label htmlFor="target_name">Target Name *</Label>
                  <Input
                    id="target_name"
                    placeholder="e.g., North Ridge Anomaly"
                    {...register('target_name')}
                  />
                  {errors.target_name && (
                    <p className="text-sm text-red-600">{errors.target_name.message}</p>
                  )}
                </div>

                {/* Commodity */}
                <div className="space-y-2">
                  <Label htmlFor="commodity">Commodity *</Label>
                  <Select onValueChange={(value) => setValue('commodity', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select commodity" />
                    </SelectTrigger>
                    <SelectContent>
                      {commodityOptions.map((commodity) => (
                        <SelectItem key={commodity} value={commodity}>
                          {commodity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.commodity && (
                    <p className="text-sm text-red-600">{errors.commodity.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Target Type */}
                <div className="space-y-2">
                  <Label htmlFor="target_type">Target Type *</Label>
                  <Select onValueChange={(value) => setValue('target_type', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drill">Drilling Target</SelectItem>
                      <SelectItem value="geophysics">Geophysical Target</SelectItem>
                      <SelectItem value="geochemistry">Geochemical Target</SelectItem>
                      <SelectItem value="mapping">Mapping Target</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.target_type && (
                    <p className="text-sm text-red-600">{errors.target_type.message}</p>
                  )}
                  {watch('target_type') && (
                    <p className="text-xs text-muted-foreground">
                      {targetTypeDescriptions[watch('target_type') as keyof typeof targetTypeDescriptions]}
                    </p>
                  )}
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select onValueChange={(value) => setValue('priority', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="medium" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location</h3>
              
              <div className="space-y-2">
                <Label>Geometry Type</Label>
                <Select value={geometryType} onValueChange={(value: 'Point' | 'Polygon') => {
                  setGeometryType(value);
                  setValue('geometry.type', value);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Point">Point Target</SelectItem>
                    <SelectItem value="Polygon">Area Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {geometryType === 'Point' && (
                <div className="space-y-2">
                  <Label>Coordinates</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Longitude"
                      type="number"
                      step="any"
                      value={watch('geometry')?.coordinates[0] || ''}
                      onChange={(e) => {
                        setValue('geometry', {
                          type: 'Point',
                          coordinates: [parseFloat(e.target.value) || 0, watch('geometry')?.coordinates[1] || 0]
                        });
                      }}
                    />
                    <Input
                      placeholder="Latitude"
                      type="number"
                      step="any"
                      value={watch('geometry')?.coordinates[1] || ''}
                      onChange={(e) => {
                        setValue('geometry', {
                          type: 'Point',
                          coordinates: [watch('geometry')?.coordinates[0] || 0, parseFloat(e.target.value) || 0]
                        });
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleLocationClick}>
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {geometryType === 'Polygon' && (
                <div className="space-y-2">
                  <Label>Area Definition</Label>
                  <p className="text-sm text-muted-foreground">
                    Use the map interface to define the target area polygon
                  </p>
                  <Button type="button" variant="outline">
                    <MapPin className="h-4 w-4 mr-2" />
                    Define Area on Map
                  </Button>
                </div>
              )}
            </div>

            {/* Target Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Target Details</h3>
              
              {/* Rationale */}
              <div className="space-y-2">
                <Label htmlFor="rationale">Rationale *</Label>
                <Textarea
                  id="rationale"
                  rows={4}
                  placeholder="Provide detailed rationale for this target, including geological reasoning, supporting evidence, and expected outcomes..."
                  {...register('rationale')}
                />
                {errors.rationale && (
                  <p className="text-sm text-red-600">{errors.rationale.message}</p>
                )}
              </div>

              {/* Confidence Level */}
              <div className="space-y-2">
                <Label>Confidence Level: {(confidenceLevel[0] * 100).toFixed(0)}%</Label>
                <Slider
                  value={confidenceLevel}
                  onValueChange={setConfidenceLevel}
                  max={1}
                  min={0}
                  step={0.01}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low Confidence</span>
                  <span>High Confidence</span>
                </div>
              </div>

              {/* Prospectivity Score */}
              <div className="space-y-2">
                <Label>Prospectivity Score: {(prospectivityScore[0] * 100).toFixed(0)}%</Label>
                <Slider
                  value={prospectivityScore}
                  onValueChange={setProspectivityScore}
                  max={1}
                  min={0}
                  step={0.01}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low Prospectivity</span>
                  <span>High Prospectivity</span>
                </div>
              </div>
            </div>

            {/* Assignment & Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Assignment & Timeline</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Assigned To */}
                <div className="space-y-2">
                  <Label htmlFor="assigned_to">Assigned To</Label>
                  <Select onValueChange={(value) => setValue('assigned_to', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers?.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name} ({member.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Target Date */}
                <div className="space-y-2">
                  <Label htmlFor="target_date">Target Date</Label>
                  <div className="relative">
                    <Input
                      id="target_date"
                      type="date"
                      {...register('target_date')}
                    />
                    <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Metadata</h3>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Data Classification */}
                <div className="space-y-2">
                  <Label htmlFor="data_classification">Data Classification</Label>
                  <Select onValueChange={(value) => setValue('data_classification', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="internal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="confidential">Confidential</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    placeholder="Data source"
                    {...register('source')}
                  />
                </div>

                {/* License */}
                <div className="space-y-2">
                  <Label htmlFor="license">License</Label>
                  <Input
                    id="license"
                    placeholder="Data license"
                    {...register('license')}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Target'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}