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
import { CalendarIcon, Gem, TrendingUp, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateMineralDepositData, MineralDeposit } from '@/integrations/supabase/enhanced-types';
import { useCreateMineralDeposit, useUpdateMineralDeposit, useMineralTypes } from '@/hooks/useApiQuery';

const mineralDepositSchema = z.object({
  site_id: z.string().min(1, 'Site is required'),
  mineral_type: z.string().min(1, 'Mineral type is required'),
  grade: z.number().min(0, 'Grade must be positive').max(100, 'Grade cannot exceed 100%'),
  tonnage: z.number().min(0, 'Tonnage must be positive').optional(),
  confidence_level: z.number().min(0, 'Confidence must be between 0-100').max(100, 'Confidence must be between 0-100'),
  discovery_date: z.date().optional(),
  coordinates: z.object({
    latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
    longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
  }).optional(),
  depth: z.number().min(0, 'Depth must be positive').optional(),
  notes: z.string().optional(),
});

type MineralDepositFormData = z.infer<typeof mineralDepositSchema>;

const commonMinerals = [
  'Gold', 'Silver', 'Copper', 'Iron', 'Lead', 'Zinc', 'Nickel', 'Platinum',
  'Palladium', 'Uranium', 'Coal', 'Diamond', 'Emerald', 'Ruby', 'Sapphire',
  'Quartz', 'Feldspar', 'Mica', 'Graphite', 'Barite', 'Fluorite', 'Gypsum',
  'Limestone', 'Dolomite', 'Sandstone', 'Shale', 'Granite', 'Basalt'
];

interface MineralDepositFormProps {
  siteId?: string;
  deposit?: MineralDeposit;
  onSuccess?: (deposit: MineralDeposit) => void;
  onCancel?: () => void;
}

export function MineralDepositForm({ siteId, deposit, onSuccess, onCancel }: MineralDepositFormProps) {
  const isEditing = !!deposit;
  const createDeposit = useCreateMineralDeposit();
  const updateDeposit = useUpdateMineralDeposit();
  const { data: mineralTypesResponse } = useMineralTypes();

  const form = useForm<MineralDepositFormData>({
    resolver: zodResolver(mineralDepositSchema),
    defaultValues: {
      site_id: siteId || deposit?.site_id || '',
      mineral_type: deposit?.mineral_type || '',
      grade: deposit?.grade || 0,
      tonnage: deposit?.tonnage || undefined,
      confidence_level: deposit?.confidence_level || 50,
      discovery_date: deposit?.discovery_date ? new Date(deposit.discovery_date) : undefined,
      coordinates: deposit?.coordinates ? {
        latitude: deposit.coordinates.latitude,
        longitude: deposit.coordinates.longitude,
      } : undefined,
      depth: deposit?.depth || undefined,
      notes: deposit?.notes || '',
    },
  });

  const onSubmit = async (data: MineralDepositFormData) => {
    try {
      if (isEditing && deposit) {
        const response = await updateDeposit.mutateAsync({
          id: deposit.id,
          updates: data,
        });
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      } else {
        const response = await createDeposit.mutateAsync(data);
        if (response.success && response.data) {
          onSuccess?.(response.data);
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const isLoading = createDeposit.isPending || updateDeposit.isPending;
  const availableMinerals = mineralTypesResponse?.success 
    ? [...new Set([...commonMinerals, ...(mineralTypesResponse.data || [])])]
    : commonMinerals;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gem className="h-5 w-5 text-purple-600" />
          {isEditing ? 'Edit Mineral Deposit' : 'Record New Deposit'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mineral_type">Mineral Type *</Label>
              <Select
                value={form.watch('mineral_type')}
                onValueChange={(value) => form.setValue('mineral_type', value)}
              >
                <SelectTrigger className={cn(
                  form.formState.errors.mineral_type && 'border-red-500'
                )}>
                  <SelectValue placeholder="Select mineral type" />
                </SelectTrigger>
                <SelectContent>
                  {availableMinerals.map((mineral) => (
                    <SelectItem key={mineral} value={mineral}>
                      {mineral}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.mineral_type && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.mineral_type.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="site_id">Site ID</Label>
              <Input
                id="site_id"
                {...form.register('site_id')}
                placeholder="Site ID"
                disabled={!!siteId}
                className={cn(
                  form.formState.errors.site_id && 'border-red-500'
                )}
              />
              {form.formState.errors.site_id && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.site_id.message}
                </p>
              )}
            </div>
          </div>

          {/* Grade and Tonnage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade" className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Grade (%) *
              </Label>
              <Input
                id="grade"
                type="number"
                step="0.01"
                {...form.register('grade', { valueAsNumber: true })}
                placeholder="0.00"
                className={cn(
                  form.formState.errors.grade && 'border-red-500'
                )}
              />
              {form.formState.errors.grade && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.grade.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tonnage">Tonnage (tons)</Label>
              <Input
                id="tonnage"
                type="number"
                step="0.01"
                {...form.register('tonnage', { valueAsNumber: true })}
                placeholder="0.00"
                className={cn(
                  form.formState.errors.tonnage && 'border-red-500'
                )}
              />
              {form.formState.errors.tonnage && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.tonnage.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="depth">Depth (meters)</Label>
              <Input
                id="depth"
                type="number"
                step="0.1"
                {...form.register('depth', { valueAsNumber: true })}
                placeholder="0.0"
                className={cn(
                  form.formState.errors.depth && 'border-red-500'
                )}
              />
              {form.formState.errors.depth && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.depth.message}
                </p>
              )}
            </div>
          </div>

          {/* Confidence Level */}
          <div className="space-y-2">
            <Label htmlFor="confidence_level" className="flex items-center justify-between">
              <span>Confidence Level (%) *</span>
              <span className={cn(
                'text-sm font-medium',
                getConfidenceColor(form.watch('confidence_level') || 0)
              )}>
                {form.watch('confidence_level') || 0}%
              </span>
            </Label>
            <Input
              id="confidence_level"
              type="range"
              min="0"
              max="100"
              step="1"
              {...form.register('confidence_level', { valueAsNumber: true })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Low (0%)</span>
              <span>Medium (50%)</span>
              <span>High (100%)</span>
            </div>
            {form.formState.errors.confidence_level && (
              <p className="text-sm text-red-500">
                {form.formState.errors.confidence_level.message}
              </p>
            )}
          </div>

          {/* Discovery Date */}
          <div className="space-y-2">
            <Label>Discovery Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !form.watch('discovery_date') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('discovery_date') ? (
                    format(form.watch('discovery_date')!, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.watch('discovery_date')}
                  onSelect={(date) => form.setValue('discovery_date', date)}
                  initialFocus
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Coordinates */}
          <div className="space-y-4">
            <Label className="text-base font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Specific Coordinates (Optional)
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Additional notes about the mineral deposit..."
              rows={4}
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
                  {isEditing ? 'Updating...' : 'Recording...'}
                </div>
              ) : (
                isEditing ? 'Update Deposit' : 'Record Deposit'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default MineralDepositForm;