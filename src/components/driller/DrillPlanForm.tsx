import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, MapPin, Calendar, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const drillPlanSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  country_code: z.string().min(2, 'Country code is required').max(3),
  data_classification: z.string().default('internal'),
  plan_name: z.string().min(1, 'Plan name is required').max(100),
  drill_type: z.enum(['diamond', 'rc', 'aircore', 'rotary', 'percussion'], {
    required_error: 'Drill type is required'
  }),
  collar_location: z.object({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).length(2)
  }),
  azimuth: z.number().min(0).max(360),
  dip: z.number().min(-90).max(90),
  target_depth: z.number().min(1, 'Target depth must be greater than 0'),
  planned_start_date: z.string(),
  estimated_duration_days: z.number().min(1, 'Duration must be at least 1 day'),
  budget_estimate: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  drilling_contractor: z.string().optional(),
  rig_type: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional()
});

type DrillPlanFormData = z.infer<typeof drillPlanSchema>;

interface DrillPlanFormProps {
  onClose: () => void;
  onSuccess: () => void;
  planId?: string;
}

interface Project {
  id: string;
  name: string;
  country_code: string;
}

export function DrillPlanForm({ onClose, onSuccess, planId }: DrillPlanFormProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<DrillPlanFormData>({
    resolver: zodResolver(drillPlanSchema),
    defaultValues: {
      data_classification: 'internal',
      currency: 'USD',
      planned_start_date: new Date().toISOString().split('T')[0],
      collar_location: {
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

  // Create drill plan mutation
  const createPlanMutation = useMutation({
    mutationFn: async (data: DrillPlanFormData) => {
      const response = await fetch('/api/v1/driller/drill-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create drill plan');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Drill plan created successfully'
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

  const onSubmit = (data: DrillPlanFormData) => {
    createPlanMutation.mutate(data);
  };

  const selectedProject = projects?.find(p => p.id === watch('project_id'));

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setValue('collar_location', {
            type: 'Point',
            coordinates: [position.coords.longitude, position.coords.latitude]
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

  // Drill type descriptions
  const drillTypeDescriptions = {
    diamond: 'Diamond core drilling for high-quality continuous core samples',
    rc: 'Reverse circulation drilling for fast, cost-effective sampling',
    aircore: 'Aircore drilling for shallow exploration and regolith sampling',
    rotary: 'Rotary drilling for large diameter holes and water wells',
    percussion: 'Percussion drilling for hard rock and mineral exploration'
  };

  // Common rig types by drill type
  const rigTypes = {
    diamond: ['LF70', 'LF90', 'CS14', 'CS1000', 'Hydracore 2000', 'UDR1200'],
    rc: ['RC350', 'RC450', 'Schramm T450', 'Atlas Copco ROC', 'Ingersoll Rand'],
    aircore: ['AC350', 'AC450', 'Aircore 1000', 'Multi-purpose rig'],
    rotary: ['Rotary 450', 'Rotary 650', 'Large rotary rig'],
    percussion: ['Percussion 350', 'Track mounted', 'Truck mounted']
  };

  const selectedDrillType = watch('drill_type');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create Drill Plan</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="technical">Technical</TabsTrigger>
                <TabsTrigger value="logistics">Logistics</TabsTrigger>
                <TabsTrigger value="budget">Budget</TabsTrigger>
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
                  {/* Plan Name */}
                  <div className="space-y-2">
                    <Label htmlFor="plan_name">Plan Name *</Label>
                    <Input
                      id="plan_name"
                      placeholder="e.g., DDH-001 North Target"
                      {...register('plan_name')}
                    />
                    {errors.plan_name && (
                      <p className="text-sm text-red-600">{errors.plan_name.message}</p>
                    )}
                  </div>

                  {/* Drill Type */}
                  <div className="space-y-2">
                    <Label htmlFor="drill_type">Drill Type *</Label>
                    <Select onValueChange={(value) => setValue('drill_type', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select drill type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diamond">💎 Diamond Core</SelectItem>
                        <SelectItem value="rc">🔄 Reverse Circulation</SelectItem>
                        <SelectItem value="aircore">💨 Aircore</SelectItem>
                        <SelectItem value="rotary">⚙️ Rotary</SelectItem>
                        <SelectItem value="percussion">🔨 Percussion</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.drill_type && (
                      <p className="text-sm text-red-600">{errors.drill_type.message}</p>
                    )}
                    {selectedDrillType && (
                      <p className="text-xs text-muted-foreground">
                        {drillTypeDescriptions[selectedDrillType]}
                      </p>
                    )}
                  </div>
                </div>

                {/* Collar Location */}
                <div className="space-y-2">
                  <Label>Collar Location *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Longitude"
                      type="number"
                      step="any"
                      value={watch('collar_location')?.coordinates[0] || ''}
                      onChange={(e) => {
                        const coords = watch('collar_location')?.coordinates || [0, 0];
                        setValue('collar_location', {
                          type: 'Point',
                          coordinates: [parseFloat(e.target.value) || 0, coords[1]]
                        });
                      }}
                    />
                    <Input
                      placeholder="Latitude"
                      type="number"
                      step="any"
                      value={watch('collar_location')?.coordinates[1] || ''}
                      onChange={(e) => {
                        const coords = watch('collar_location')?.coordinates || [0, 0];
                        setValue('collar_location', {
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
                  {/* Planned Start Date */}
                  <div className="space-y-2">
                    <Label htmlFor="planned_start_date">Planned Start Date *</Label>
                    <div className="relative">
                      <Input
                        id="planned_start_date"
                        type="date"
                        {...register('planned_start_date')}
                      />
                      <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                    {errors.planned_start_date && (
                      <p className="text-sm text-red-600">{errors.planned_start_date.message}</p>
                    )}
                  </div>

                  {/* Estimated Duration */}
                  <div className="space-y-2">
                    <Label htmlFor="estimated_duration_days">Estimated Duration (days) *</Label>
                    <Input
                      id="estimated_duration_days"
                      type="number"
                      min="1"
                      placeholder="e.g., 15"
                      {...register('estimated_duration_days', { valueAsNumber: true })}
                    />
                    {errors.estimated_duration_days && (
                      <p className="text-sm text-red-600">{errors.estimated_duration_days.message}</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Azimuth */}
                  <div className="space-y-2">
                    <Label htmlFor="azimuth">Azimuth (°) *</Label>
                    <Input
                      id="azimuth"
                      type="number"
                      min="0"
                      max="360"
                      step="1"
                      placeholder="0-360"
                      {...register('azimuth', { valueAsNumber: true })}
                    />
                    {errors.azimuth && (
                      <p className="text-sm text-red-600">{errors.azimuth.message}</p>
                    )}
                  </div>

                  {/* Dip */}
                  <div className="space-y-2">
                    <Label htmlFor="dip">Dip (°) *</Label>
                    <Input
                      id="dip"
                      type="number"
                      min="-90"
                      max="90"
                      step="1"
                      placeholder="-90 to 90"
                      {...register('dip', { valueAsNumber: true })}
                    />
                    {errors.dip && (
                      <p className="text-sm text-red-600">{errors.dip.message}</p>
                    )}
                  </div>

                  {/* Target Depth */}
                  <div className="space-y-2">
                    <Label htmlFor="target_depth">Target Depth (m) *</Label>
                    <Input
                      id="target_depth"
                      type="number"
                      min="1"
                      step="0.1"
                      placeholder="e.g., 500"
                      {...register('target_depth', { valueAsNumber: true })}
                    />
                    {errors.target_depth && (
                      <p className="text-sm text-red-600">{errors.target_depth.message}</p>
                    )}
                  </div>
                </div>

                {/* Technical Notes */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">Drilling Parameters Guide</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Azimuth:</strong> Compass bearing (0° = North, 90° = East)</p>
                    <p><strong>Dip:</strong> Angle from horizontal (-90° = straight up, 0° = horizontal, -90° = straight down)</p>
                    <p><strong>Depth:</strong> Total planned depth from collar</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="logistics" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Drilling Contractor */}
                  <div className="space-y-2">
                    <Label htmlFor="drilling_contractor">Drilling Contractor</Label>
                    <Input
                      id="drilling_contractor"
                      placeholder="e.g., ABC Drilling Services"
                      {...register('drilling_contractor')}
                    />
                  </div>

                  {/* Rig Type */}
                  <div className="space-y-2">
                    <Label htmlFor="rig_type">Rig Type</Label>
                    <Select onValueChange={(value) => setValue('rig_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rig type" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDrillType && rigTypes[selectedDrillType]?.map((rig) => (
                          <SelectItem key={rig} value={rig}>
                            {rig}
                          </SelectItem>
                        ))}
                        <SelectItem value="other">Other (specify in notes)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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

                <div className="grid grid-cols-2 gap-4">
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
              </TabsContent>

              <TabsContent value="budget" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Budget Estimate */}
                  <div className="space-y-2">
                    <Label htmlFor="budget_estimate">Budget Estimate</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="budget_estimate"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-10"
                        {...register('budget_estimate', { valueAsNumber: true })}
                      />
                    </div>
                    {errors.budget_estimate && (
                      <p className="text-sm text-red-600">{errors.budget_estimate.message}</p>
                    )}
                  </div>

                  {/* Currency */}
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select onValueChange={(value) => setValue('currency', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="USD" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CAD">CAD</SelectItem>
                        <SelectItem value="AUD">AUD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Budget Breakdown Guide */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium mb-2">Typical Drilling Costs</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Diamond Core:</strong> $150-300/m depending on depth and conditions</p>
                    <p><strong>RC Drilling:</strong> $80-150/m for standard conditions</p>
                    <p><strong>Aircore:</strong> $30-80/m for shallow drilling</p>
                    <p><strong>Additional:</strong> Mobilization, accommodation, consumables</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Drill Plan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}