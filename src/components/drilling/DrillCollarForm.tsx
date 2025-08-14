import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Save, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const drillCollarSchema = z.object({
  hole_id: z.string().min(1, 'Hole ID is required').max(50),
  easting: z.number().min(-180).max(180),
  northing: z.number().min(-90).max(90),
  elevation: z.number(),
  total_depth: z.number().min(0.1, 'Total depth must be greater than 0'),
  azimuth: z.number().min(0).max(360).optional(),
  dip: z.number().min(-90).max(90).optional(),
  drill_date: z.string().optional(),
  drill_type: z.string().optional(),
  contractor: z.string().optional(),
  status: z.string().optional(),
  country_code: z.string().length(2),
  data_classification: z.enum(['public', 'internal', 'confidential']),
  description: z.string().optional()
});

type DrillCollarFormData = z.infer<typeof drillCollarSchema>;

interface DrillCollarFormProps {
  projectId: string;
  orgId: string;
  initialData?: Partial<DrillCollarFormData>;
  onSubmit: (data: DrillCollarFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DrillCollarForm({
  projectId,
  orgId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false
}: DrillCollarFormProps) {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<DrillCollarFormData>({
    resolver: zodResolver(drillCollarSchema),
    defaultValues: {
      status: 'planned',
      data_classification: 'internal',
      country_code: 'AU',
      ...initialData
    }
  });

  const handleFormSubmit = async (data: DrillCollarFormData) => {
    try {
      await onSubmit(data);
      toast({
        title: "Success",
        description: "Drill collar saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save drill collar",
        variant: "destructive"
      });
    }
  };

  const handleCoordinateImport = () => {
    // This would open a GPS coordinate import dialog
    toast({
      title: "GPS Import",
      description: "GPS coordinate import feature coming soon"
    });
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          {initialData ? 'Edit Drill Collar' : 'New Drill Collar'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hole_id">Hole ID *</Label>
              <Input
                id="hole_id"
                {...register('hole_id')}
                placeholder="e.g., DDH001"
                className={errors.hole_id ? 'border-red-500' : ''}
              />
              {errors.hole_id && (
                <p className="text-sm text-red-500 mt-1">{errors.hole_id.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="drill_type">Drill Type</Label>
              <Select onValueChange={(value) => setValue('drill_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select drill type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD">Diamond Drilling (DD)</SelectItem>
                  <SelectItem value="RC">Reverse Circulation (RC)</SelectItem>
                  <SelectItem value="RAB">Rotary Air Blast (RAB)</SelectItem>
                  <SelectItem value="AC">Air Core (AC)</SelectItem>
                  <SelectItem value="PER">Percussion</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Location</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCoordinateImport}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import GPS
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="easting">Easting *</Label>
                <Input
                  id="easting"
                  type="number"
                  step="0.000001"
                  {...register('easting', { valueAsNumber: true })}
                  placeholder="e.g., 123.456789"
                  className={errors.easting ? 'border-red-500' : ''}
                />
                {errors.easting && (
                  <p className="text-sm text-red-500 mt-1">{errors.easting.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="northing">Northing *</Label>
                <Input
                  id="northing"
                  type="number"
                  step="0.000001"
                  {...register('northing', { valueAsNumber: true })}
                  placeholder="e.g., -23.456789"
                  className={errors.northing ? 'border-red-500' : ''}
                />
                {errors.northing && (
                  <p className="text-sm text-red-500 mt-1">{errors.northing.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="elevation">Elevation (m) *</Label>
                <Input
                  id="elevation"
                  type="number"
                  step="0.1"
                  {...register('elevation', { valueAsNumber: true })}
                  placeholder="e.g., 450.5"
                  className={errors.elevation ? 'border-red-500' : ''}
                />
                {errors.elevation && (
                  <p className="text-sm text-red-500 mt-1">{errors.elevation.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Drilling Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total_depth">Total Depth (m) *</Label>
              <Input
                id="total_depth"
                type="number"
                step="0.1"
                {...register('total_depth', { valueAsNumber: true })}
                placeholder="e.g., 150.0"
                className={errors.total_depth ? 'border-red-500' : ''}
              />
              {errors.total_depth && (
                <p className="text-sm text-red-500 mt-1">{errors.total_depth.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => setValue('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="drilling">Drilling</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="azimuth">Azimuth (°)</Label>
                    <Input
                      id="azimuth"
                      type="number"
                      step="0.1"
                      min="0"
                      max="360"
                      {...register('azimuth', { valueAsNumber: true })}
                      placeholder="e.g., 45.0"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dip">Dip (°)</Label>
                    <Input
                      id="dip"
                      type="number"
                      step="0.1"
                      min="-90"
                      max="90"
                      {...register('dip', { valueAsNumber: true })}
                      placeholder="e.g., -60.0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="drill_date">Drill Date</Label>
                    <Input
                      id="drill_date"
                      type="date"
                      {...register('drill_date')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="contractor">Contractor</Label>
                    <Input
                      id="contractor"
                      {...register('contractor')}
                      placeholder="e.g., ABC Drilling Co."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="country_code">Country Code</Label>
                    <Select onValueChange={(value) => setValue('country_code', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="ZA">South Africa</SelectItem>
                        <SelectItem value="CL">Chile</SelectItem>
                        <SelectItem value="PE">Peru</SelectItem>
                        <SelectItem value="BR">Brazil</SelectItem>
                        <SelectItem value="MX">Mexico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="data_classification">Data Classification</Label>
                    <Select onValueChange={(value) => setValue('data_classification', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select classification" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="confidential">Confidential</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Additional notes about this drill hole..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting || isLoading ? 'Saving...' : 'Save Collar'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}