import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const esgSignoffSchema = z.object({
  project_id: z.string().uuid('Please select a project'),
  country_code: z.string().min(2, 'Country code is required').max(3),
  data_classification: z.string().default('internal'),
  esg_category: z.enum(['environmental', 'social', 'governance'], {
    required_error: 'ESG category is required'
  }),
  requirement_type: z.string().min(1, 'Requirement type is required'),
  due_date: z.string().optional(),
  compliance_notes: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high']).default('medium'),
  source: z.string().optional(),
  license: z.string().optional()
});

type ESGSignoffFormData = z.infer<typeof esgSignoffSchema>;

interface ESGSignoffFormProps {
  onClose: () => void;
  onSuccess: () => void;
  signoffId?: string;
}

interface Project {
  id: string;
  name: string;
  country_code: string;
}

export function ESGSignoffForm({ onClose, onSuccess, signoffId }: ESGSignoffFormProps) {
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ESGSignoffFormData>({
    resolver: zodResolver(esgSignoffSchema),
    defaultValues: {
      data_classification: 'internal',
      risk_level: 'medium'
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

  // Create ESG signoff mutation
  const createSignoffMutation = useMutation({
    mutationFn: async (data: ESGSignoffFormData) => {
      const payload = {
        ...data,
        due_date: data.due_date ? new Date(data.due_date).toISOString() : null
      };
      
      const response = await fetch('/api/v1/executive/esg-signoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to create ESG signoff');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'ESG signoff requirement created successfully'
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

  const onSubmit = (data: ESGSignoffFormData) => {
    createSignoffMutation.mutate(data);
  };

  const selectedProject = projects?.find(p => p.id === watch('project_id'));

  // Common requirement types by category
  const requirementTypes = {
    environmental: [
      'Environmental Impact Assessment',
      'Water Quality Monitoring',
      'Air Quality Compliance',
      'Waste Management Plan',
      'Biodiversity Assessment',
      'Rehabilitation Bond',
      'Carbon Footprint Report'
    ],
    social: [
      'Community Consultation',
      'Indigenous Rights Agreement',
      'Local Employment Plan',
      'Social Impact Assessment',
      'Stakeholder Engagement',
      'Cultural Heritage Survey',
      'Grievance Mechanism'
    ],
    governance: [
      'Board Approval',
      'Regulatory Compliance',
      'Anti-Corruption Policy',
      'Transparency Report',
      'Risk Management Framework',
      'Audit Committee Review',
      'Whistleblower Policy'
    ]
  };

  const selectedCategory = watch('esg_category');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create ESG Signoff Requirement</CardTitle>
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
              {/* ESG Category */}
              <div className="space-y-2">
                <Label htmlFor="esg_category">ESG Category *</Label>
                <Select onValueChange={(value) => {
                  setValue('esg_category', value as any);
                  setValue('requirement_type', ''); // Reset requirement type
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="environmental">Environmental</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="governance">Governance</SelectItem>
                  </SelectContent>
                </Select>
                {errors.esg_category && (
                  <p className="text-sm text-red-600">{errors.esg_category.message}</p>
                )}
              </div>

              {/* Risk Level */}
              <div className="space-y-2">
                <Label htmlFor="risk_level">Risk Level</Label>
                <Select onValueChange={(value) => setValue('risk_level', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="medium" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Requirement Type */}
            <div className="space-y-2">
              <Label htmlFor="requirement_type">Requirement Type *</Label>
              {selectedCategory ? (
                <Select onValueChange={(value) => setValue('requirement_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select requirement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {requirementTypes[selectedCategory]?.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom (enter below)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="requirement_type"
                  placeholder="Enter requirement type"
                  {...register('requirement_type')}
                />
              )}
              {errors.requirement_type && (
                <p className="text-sm text-red-600">{errors.requirement_type.message}</p>
              )}
            </div>

            {/* Custom requirement type input */}
            {watch('requirement_type') === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom_requirement">Custom Requirement Type</Label>
                <Input
                  id="custom_requirement"
                  placeholder="Enter custom requirement type"
                  onChange={(e) => setValue('requirement_type', e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <div className="relative">
                  <Input
                    id="due_date"
                    type="date"
                    {...register('due_date')}
                  />
                  <Calendar className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

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

            {/* Compliance Notes */}
            <div className="space-y-2">
              <Label htmlFor="compliance_notes">Compliance Notes</Label>
              <Textarea
                id="compliance_notes"
                rows={3}
                placeholder="Additional compliance notes and requirements..."
                {...register('compliance_notes')}
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
                {isSubmitting ? 'Creating...' : 'Create Requirement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}