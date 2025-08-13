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
import { MapPin, Mountain, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CreateSiteData, ExplorationSite } from '@/integrations/supabase/enhanced-types';
import { useCreateSite, useUpdateSite } from '@/hooks/useApiQuery';

const siteSchema = z.object({
  project_id: z.string().min(1, 'Project is required'),
  name: z.string().min(1, 'Site name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
    longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  }),
  elevation: z.number().optional(),
  access_notes: z.string().optional(),
  site_type: z.enum(['outcrop', 'drill_site', 'sample_location', 'survey_point', 'other']),
});

type SiteFormData = z.infer<typeof siteSchema>;

const siteTypes = [
  { value: 'outcrop', label: 'Outcrop' },
  { value: 'drill_site', label: 'Drill Site' },
  { value: 'sample_location', label: 'Sample Location' },
  { value: 'survey_point', label: 'Survey Point' },
  { value: 'other', label: 'Other' },
] as const;

interface SiteFormProps {
  projectId?: string;
  site?: ExplorationSite;
  onSuccess?: (site: ExplorationSite) => void;
  onCancel?: () => void;
}

export function SiteForm({ projectId, site, onSuccess, onCancel }: SiteFormProps) {
  const isEditing = !!site;
  const createSite = useCreateSite();
  const updateSite = useUpdateSite();

  const form = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      project_id: projectId || site?.project_id || '',
      name: site?.name || '',
      description: site?.description || '',
      coordinates: site?.coordinates ? {
        latitude: site.coordinates.latitude,
        longitude: site.coordinates.longitude,
      } : {
        latitude: 0,
        longitude: 0,
      },
      elevation: site?.elevation || undefined,
      access_notes: site?.access_notes || '',
      site_type: site?.site_type || 'outcrop',
    },
  });

  const onSubmit = async (data: SiteFormData) => {
    try {
      if (isEditing && site) {
        const response = await updateSite.mutateAsync({
          id: site.id,
          updates: data,
        });
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      } else {
        const response = await createSite.mutateAsync(data);
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const isLoading = createSite.isPending || updateSite.isPending;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mountain className="h-5 w-5 text-green-600" />
          {isEditing ? 'Edit Exploration Site' : 'Add New Site'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site Name *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter site name"
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
              <Label htmlFor="site_type">Site Type *</Label>
              <Select
                value={form.watch('site_type')}
                onValueChange={(value) => form.setValue('site_type', value as any)}
              >
                <SelectTrigger className={cn(
                  form.formState.errors.site_type && 'border-red-500'
                )}>
                  <SelectValue placeholder="Select site type" />
                </SelectTrigger>
                <SelectContent>
                  {siteTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.site_type && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.site_type.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Enter site description"
              rows={3}
            />
          </div>

          {/* Coordinates */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              Coordinates *
            </Label>
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

          {/* Additional Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="elevation">Elevation (meters)</Label>
              <Input
                id="elevation"
                type="number"
                step="0.1"
                {...form.register('elevation', { valueAsNumber: true })}
                placeholder="e.g., 1250.5"
                className={cn(
                  form.formState.errors.elevation && 'border-red-500'
                )}
              />
              {form.formState.errors.elevation && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.elevation.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_id">Project ID</Label>
              <Input
                id="project_id"
                {...form.register('project_id')}
                placeholder="Project ID"
                disabled={!!projectId}
                className={cn(
                  form.formState.errors.project_id && 'border-red-500'
                )}
              />
              {form.formState.errors.project_id && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.project_id.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access_notes">Access Notes</Label>
            <Textarea
              id="access_notes"
              {...form.register('access_notes')}
              placeholder="Notes about site access, equipment needed, safety considerations, etc."
              rows={3}
            />
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
                isEditing ? 'Update Site' : 'Create Site'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default SiteForm;