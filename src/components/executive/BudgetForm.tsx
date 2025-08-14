import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const budgetSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  country_code: z.string().min(2, 'Country code is required').max(3),
  data_classification: z.string().default('internal'),
  budget_type: z.enum(['exploration', 'development', 'operations'], {
    required_error: 'Budget type is required'
  }),
  fiscal_year: z.number().min(2020).max(2030),
  approved_amount: z.number().min(0, 'Amount must be positive'),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  source: z.string().optional(),
  license: z.string().optional()
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  onClose: () => void;
  onSuccess: () => void;
  budgetId?: string;
}

interface Project {
  id: string;
  name: string;
  country_code: string;
}

export function BudgetForm({ onClose, onSuccess, budgetId }: BudgetFormProps) {
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      data_classification: 'internal',
      currency: 'USD',
      fiscal_year: new Date().getFullYear()
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

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const response = await fetch('/api/v1/executive/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create budget');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Budget created successfully'
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

  const onSubmit = (data: BudgetFormData) => {
    createBudgetMutation.mutate(data);
  };

  const selectedProject = projects?.find(p => p.id === watch('project_id'));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create Budget Entry</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {/* Budget Type */}
              <div className="space-y-2">
                <Label htmlFor="budget_type">Budget Type *</Label>
                <Select onValueChange={(value) => setValue('budget_type', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exploration">Exploration</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
                {errors.budget_type && (
                  <p className="text-sm text-red-600">{errors.budget_type.message}</p>
                )}
              </div>

              {/* Fiscal Year */}
              <div className="space-y-2">
                <Label htmlFor="fiscal_year">Fiscal Year *</Label>
                <Input
                  id="fiscal_year"
                  type="number"
                  min="2020"
                  max="2030"
                  {...register('fiscal_year', { valueAsNumber: true })}
                />
                {errors.fiscal_year && (
                  <p className="text-sm text-red-600">{errors.fiscal_year.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Approved Amount */}
              <div className="space-y-2">
                <Label htmlFor="approved_amount">Approved Amount *</Label>
                <Input
                  id="approved_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('approved_amount', { valueAsNumber: true })}
                />
                {errors.approved_amount && (
                  <p className="text-sm text-red-600">{errors.approved_amount.message}</p>
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

            <div className="grid grid-cols-2 gap-4">
              {/* Country Code */}
              <div className="space-y-2">
                <Label htmlFor="country_code">Country Code</Label>
                <Input
                  id="country_code"
                  maxLength={3}
                  value={selectedProject?.country_code || ''}
                  {...register('country_code')}
                  readOnly
                />
                {errors.country_code && (
                  <p className="text-sm text-red-600">{errors.country_code.message}</p>
                )}
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
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Additional notes about this budget..."
                {...register('notes')}
              />
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

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Budget'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}