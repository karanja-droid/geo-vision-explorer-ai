import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateProjectData, Project } from '@/integrations/supabase/enhanced-types';
import { useCreateProject, useUpdateProject } from '@/hooks/useApiQuery';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  budget: z.number().min(0, 'Budget must be positive').optional(),
  start_date: z.date().optional(),
  end_date: z.date().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return data.end_date >= data.start_date;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  project?: Project;
  onSuccess?: (project: Project) => void;
  onCancel?: () => void;
}

export function ProjectForm({ project, onSuccess, onCancel }: ProjectFormProps) {
  const isEditing = !!project;
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      location: project?.location || '',
      budget: project?.budget || undefined,
      start_date: project?.start_date ? new Date(project.start_date) : undefined,
      end_date: project?.end_date ? new Date(project.end_date) : undefined,
      coordinates: project?.coordinates ? {
        latitude: project.coordinates.latitude,
        longitude: project.coordinates.longitude,
      } : undefined,
    },
  });

  const onSubmit = async (data: ProjectFormData) => {
    try {
      if (isEditing && project) {
        const response = await updateProject.mutateAsync({
          id: project.id,
          updates: data,
        });
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      } else {
        const response = await createProject.mutateAsync(data);
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const isLoading = createProject.isPending || updateProject.isPending;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          {isEditing ? 'Edit Project' : 'Create New Project'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter project name"
                className={cn(
                  form.formState.errors.name && 'border-red-500'
                )}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                {...form.register('location')}
                placeholder="Enter location"
                className={cn(
                  form.formState.errors.location && 'border-red-500'
                )}
              />
              {form.formState.errors.location && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.location.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Enter project description"
              rows={3}
            />
          </div>

          {/* Financial & Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Budget
              </Label>
              <Input
                id="budget"
                type="number"
                step="0.01"
                {...form.register('budget', { valueAsNumber: true })}
                placeholder="0.00"
                className={cn(
                  form.formState.errors.budget && 'border-red-500'
                )}
              />
              {form.formState.errors.budget && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.budget.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('start_date') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('start_date') ? (
                      format(form.watch('start_date')!, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch('start_date')}
                    onSelect={(date) => form.setValue('start_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('end_date') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('end_date') ? (
                      format(form.watch('end_date')!, 'PPP')
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={form.watch('end_date')}
                    onSelect={(date) => form.setValue('end_date', date)}
                    initialFocus
                    disabled={(date) => {
                      const startDate = form.watch('start_date');
                      return startDate ? date < startDate : false;
                    }}
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.end_date && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.end_date.message}
                </p>
              )}
            </div>
          </div>

          {/* Coordinates */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Coordinates (Optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  {...form.register('coordinates.latitude', { valueAsNumber: true })}
                  placeholder="e.g., 40.7128"
                  className={cn(
                    form.formState.errors.coordinates?.latitude && 'border-red-500'
                  )}
                />
                {form.formState.errors.coordinates?.latitude && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.coordinates.latitude.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  {...form.register('coordinates.longitude', { valueAsNumber: true })}
                  placeholder="e.g., -74.0060"
                  className={cn(
                    form.formState.errors.coordinates?.longitude && 'border-red-500'
                  )}
                />
                {form.formState.errors.coordinates?.longitude && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.coordinates.longitude.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                isEditing ? 'Update Project' : 'Create Project'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default ProjectForm;