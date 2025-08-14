import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Clock, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const dailyReportSchema = z.object({
  drill_plan_id: z.string().uuid('Please select a drill plan'),
  report_date: z.string(),
  shift: z.enum(['day', 'night', '24hr'], {
    required_error: 'Shift is required'
  }),
  metres_drilled: z.number().min(0, 'Metres drilled cannot be negative'),
  total_depth: z.number().min(0, 'Total depth cannot be negative'),
  core_recovery_percent: z.number().min(0).max(100).optional(),
  drilling_fluid: z.string().optional(),
  downtime_hours: z.number().min(0).max(24),
  downtime_reason: z.string().optional(),
  rop_average: z.number().min(0).optional(),
  safety_incidents: z.number().min(0).int(),
  weather_conditions: z.string().optional(),
  crew_notes: z.string().optional(),
  driller_name: z.string().min(1, 'Driller name is required')
});

type DailyReportFormData = z.infer<typeof dailyReportSchema>;

interface DailyReportFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface DrillPlan {
  id: string;
  plan_name: string;
  drill_type: string;
  target_depth: number;
}

export function DailyReportForm({ onClose, onSuccess }: DailyReportFormProps) {
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<DailyReportFormData>({
    resolver: zodResolver(dailyReportSchema),
    defaultValues: {
      report_date: new Date().toISOString().split('T')[0],
      metres_drilled: 0,
      downtime_hours: 0,
      safety_incidents: 0
    }
  });

  // Fetch active drill plans
  const { data: drillPlans } = useQuery<DrillPlan[]>({
    queryKey: ['active-drill-plans'],
    queryFn: async () => {
      const response = await fetch('/api/v1/driller/drill-plans?status=active');
      if (!response.ok) throw new Error('Failed to fetch drill plans');
      return response.json();
    }
  });

  // Create daily report mutation
  const createReportMutation = useMutation({
    mutationFn: async (data: DailyReportFormData) => {
      const response = await fetch('/api/v1/driller/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create daily report');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Daily report created successfully'
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

  const onSubmit = (data: DailyReportFormData) => {
    createReportMutation.mutate(data);
  };

  const selectedPlan = drillPlans?.find(p => p.id === watch('drill_plan_id'));
  const downtimeHours = watch('downtime_hours');
  const safetyIncidents = watch('safety_incidents');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily Drilling Report
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Report Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Drill Plan Selection */}
                <div className="space-y-2">
                  <Label htmlFor="drill_plan_id">Drill Plan *</Label>
                  <Select onValueChange={(value) => setValue('drill_plan_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drill plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {drillPlans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.plan_name} ({plan.drill_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.drill_plan_id && (
                    <p className="text-sm text-red-600">{errors.drill_plan_id.message}</p>
                  )}
                </div>

                {/* Report Date */}
                <div className="space-y-2">
                  <Label htmlFor="report_date">Report Date *</Label>
                  <Input
                    id="report_date"
                    type="date"
                    {...register('report_date')}
                  />
                  {errors.report_date && (
                    <p className="text-sm text-red-600">{errors.report_date.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Shift */}
                <div className="space-y-2">
                  <Label htmlFor="shift">Shift *</Label>
                  <Select onValueChange={(value) => setValue('shift', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day Shift</SelectItem>
                      <SelectItem value="night">Night Shift</SelectItem>
                      <SelectItem value="24hr">24 Hour Operation</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.shift && (
                    <p className="text-sm text-red-600">{errors.shift.message}</p>
                  )}
                </div>

                {/* Driller Name */}
                <div className="space-y-2">
                  <Label htmlFor="driller_name">Driller Name *</Label>
                  <Input
                    id="driller_name"
                    placeholder="Enter driller name"
                    {...register('driller_name')}
                  />
                  {errors.driller_name && (
                    <p className="text-sm text-red-600">{errors.driller_name.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Drilling Progress */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Drilling Progress</h3>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Metres Drilled */}
                <div className="space-y-2">
                  <Label htmlFor="metres_drilled">Metres Drilled *</Label>
                  <Input
                    id="metres_drilled"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.0"
                    {...register('metres_drilled', { valueAsNumber: true })}
                  />
                  {errors.metres_drilled && (
                    <p className="text-sm text-red-600">{errors.metres_drilled.message}</p>
                  )}
                </div>

                {/* Total Depth */}
                <div className="space-y-2">
                  <Label htmlFor="total_depth">Total Depth (m) *</Label>
                  <Input
                    id="total_depth"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.0"
                    {...register('total_depth', { valueAsNumber: true })}
                  />
                  {errors.total_depth && (
                    <p className="text-sm text-red-600">{errors.total_depth.message}</p>
                  )}
                </div>

                {/* ROP Average */}
                <div className="space-y-2">
                  <Label htmlFor="rop_average">ROP Average (m/hr)</Label>
                  <Input
                    id="rop_average"
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0.0"
                    {...register('rop_average', { valueAsNumber: true })}
                  />
                </div>
              </div>

              {selectedPlan && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm">
                    <strong>Target Depth:</strong> {selectedPlan.target_depth}m • 
                    <strong> Progress:</strong> {watch('total_depth') ? 
                      ((watch('total_depth') / selectedPlan.target_depth) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              )}
            </div>

            {/* Core Recovery & Fluids */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Core Recovery & Fluids</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Core Recovery */}
                <div className="space-y-2">
                  <Label htmlFor="core_recovery_percent">Core Recovery (%)</Label>
                  <Input
                    id="core_recovery_percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0-100"
                    {...register('core_recovery_percent', { valueAsNumber: true })}
                  />
                  {errors.core_recovery_percent && (
                    <p className="text-sm text-red-600">{errors.core_recovery_percent.message}</p>
                  )}
                </div>

                {/* Drilling Fluid */}
                <div className="space-y-2">
                  <Label htmlFor="drilling_fluid">Drilling Fluid</Label>
                  <Select onValueChange={(value) => setValue('drilling_fluid', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fluid type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="water">Water</SelectItem>
                      <SelectItem value="mud">Drilling Mud</SelectItem>
                      <SelectItem value="foam">Foam</SelectItem>
                      <SelectItem value="air">Air</SelectItem>
                      <SelectItem value="polymer">Polymer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Downtime & Issues */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Downtime & Issues</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Downtime Hours */}
                <div className="space-y-2">
                  <Label htmlFor="downtime_hours">Downtime Hours *</Label>
                  <Input
                    id="downtime_hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.1"
                    placeholder="0.0"
                    {...register('downtime_hours', { valueAsNumber: true })}
                  />
                  {errors.downtime_hours && (
                    <p className="text-sm text-red-600">{errors.downtime_hours.message}</p>
                  )}
                  {downtimeHours > 0 && (
                    <p className="text-xs text-orange-600">⚠️ Downtime recorded</p>
                  )}
                </div>

                {/* Safety Incidents */}
                <div className="space-y-2">
                  <Label htmlFor="safety_incidents">Safety Incidents *</Label>
                  <Input
                    id="safety_incidents"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    {...register('safety_incidents', { valueAsNumber: true })}
                  />
                  {errors.safety_incidents && (
                    <p className="text-sm text-red-600">{errors.safety_incidents.message}</p>
                  )}
                  {safetyIncidents > 0 && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Safety incident(s) reported
                    </p>
                  )}
                </div>
              </div>

              {/* Downtime Reason */}
              {downtimeHours > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="downtime_reason">Downtime Reason</Label>
                  <Textarea
                    id="downtime_reason"
                    rows={2}
                    placeholder="Describe the reason for downtime..."
                    {...register('downtime_reason')}
                  />
                </div>
              )}
            </div>

            {/* Environmental & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Environmental & Notes</h3>
              
              {/* Weather Conditions */}
              <div className="space-y-2">
                <Label htmlFor="weather_conditions">Weather Conditions</Label>
                <Input
                  id="weather_conditions"
                  placeholder="e.g., Clear, 25°C, light wind"
                  {...register('weather_conditions')}
                />
              </div>

              {/* Crew Notes */}
              <div className="space-y-2">
                <Label htmlFor="crew_notes">Crew Notes</Label>
                <Textarea
                  id="crew_notes"
                  rows={3}
                  placeholder="Additional notes about the drilling operation, equipment performance, geological observations, etc."
                  {...register('crew_notes')}
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Report'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}