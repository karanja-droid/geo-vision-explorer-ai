import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TestTube, Save, X, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const geochemSampleSchema = z.object({
  sample_id: z.string().min(1, 'Sample ID is required').max(50),
  sample_type: z.string().min(1, 'Sample type is required'),
  easting: z.number().min(-180).max(180),
  northing: z.number().min(-90).max(90),
  elevation: z.number().optional(),
  collection_date: z.string().optional(),
  collector: z.string().optional(),
  sample_weight_kg: z.number().min(0).optional(),
  description: z.string().optional(),
  country_code: z.string().length(2),
  data_classification: z.enum(['public', 'internal', 'confidential'])
});

type GeochemSampleFormData = z.infer<typeof geochemSampleSchema>;

interface GeochemSampleFormProps {
  projectId: string;
  orgId: string;
  initialData?: Partial<GeochemSampleFormData>;
  onSubmit: (data: GeochemSampleFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GeochemSampleForm({
  projectId,
  orgId,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false
}: GeochemSampleFormProps) {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<GeochemSampleFormData>({
    resolver: zodResolver(geochemSampleSchema),
    defaultValues: {
      data_classification: 'internal',
      country_code: 'AU',
      ...initialData
    }
  });

  const handleFormSubmit = async (data: GeochemSampleFormData) => {
    try {
      await onSubmit(data);
      toast({
        title: "Success",
        description: "Geochemistry sample saved successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save geochemistry sample",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          {initialData ? 'Edit Geochemistry Sample' : 'New Geochemistry Sample'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sample_id">Sample ID *</Label>
              <Input
                id="sample_id"
                {...register('sample_id')}
                placeholder="e.g., SOIL001"
                className={errors.sample_id ? 'border-red-500' : ''}
              />
              {errors.sample_id && (
                <p className="text-sm text-red-500 mt-1">{errors.sample_id.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="sample_type">Sample Type *</Label>
              <Select onValueChange={(value) => setValue('sample_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sample type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soil">Soil</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="stream_sediment">Stream Sediment</SelectItem>
                  <SelectItem value="till">Till</SelectItem>
                  <SelectItem value="vegetation">Vegetation</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.sample_type && (
                <p className="text-sm text-red-500 mt-1">{errors.sample_type.message}</p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <h3 className="text-lg font-semibold">Sample Location</h3>
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
                <Label htmlFor="elevation">Elevation (m)</Label>
                <Input
                  id="elevation"
                  type="number"
                  step="0.1"
                  {...register('elevation', { valueAsNumber: true })}
                  placeholder="e.g., 450.5"
                />
              </div>
            </div>
          </div>

          {/* Collection Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <h3 className="text-lg font-semibold">Collection Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="collection_date">Collection Date</Label>
                <Input
                  id="collection_date"
                  type="date"
                  {...register('collection_date')}
                />
              </div>

              <div>
                <Label htmlFor="collector">Collector</Label>
                <Input
                  id="collector"
                  {...register('collector')}
                  placeholder="e.g., John Smith"
                />
              </div>

              <div>
                <Label htmlFor="sample_weight_kg">Sample Weight (kg)</Label>
                <Input
                  id="sample_weight_kg"
                  type="number"
                  step="0.001"
                  min="0"
                  {...register('sample_weight_kg', { valueAsNumber: true })}
                  placeholder="e.g., 0.5"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Additional Information</h3>

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
                    <SelectItem value="GH">Ghana</SelectItem>
                    <SelectItem value="TZ">Tanzania</SelectItem>
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
                placeholder="Additional notes about this sample..."
                rows={3}
              />
            </div>
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
              {isSubmitting || isLoading ? 'Saving...' : 'Save Sample'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}