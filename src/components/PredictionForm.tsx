import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePredictions, CreatePredictionData } from '@/hooks/usePredictions';
import { useAIModels } from '@/hooks/useAIModels';
import { Brain } from 'lucide-react';

const predictionSchema = z.object({
  model_id: z.string().min(1, 'AI Model is required'),
  site_id: z.string().min(1, 'Site is required'),
  confidence_score: z.number().min(0).max(100).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  mineral_type: z.string().optional(),
  expected_yield: z.string().optional(),
  risk_level: z.string().optional(),
  recommendation: z.string().optional(),
});

interface PredictionFormProps {
  siteId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PredictionForm: React.FC<PredictionFormProps> = ({
  siteId,
  onSuccess,
  onCancel
}) => {
  const { createPrediction } = usePredictions();
  const { getActiveModels } = useAIModels();

  const activeModels = getActiveModels();

  const form = useForm<z.infer<typeof predictionSchema>>({
    resolver: zodResolver(predictionSchema),
    defaultValues: {
      model_id: '',
      site_id: siteId || '',
      confidence_score: undefined,
      status: 'pending',
      mineral_type: '',
      expected_yield: '',
      risk_level: '',
      recommendation: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof predictionSchema>) => {
    try {
      if (!values.model_id || !values.site_id) {
        throw new Error('Model ID and Site ID are required');
      }
      
      const { mineral_type, expected_yield, risk_level, recommendation, ...baseValues } = values;
      
      const predictionData: CreatePredictionData = {
        ...baseValues,
        model_id: values.model_id,
        site_id: values.site_id,
        prediction_data: {
          mineral_type,
          expected_yield,
          risk_level,
          recommendation,
        },
      };
      
      await createPrediction(predictionData);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating prediction:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Create AI Prediction
        </CardTitle>
        <CardDescription>
          Generate a new AI-powered mineral exploration prediction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="model_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Model</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select AI model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} v{model.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mineral_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Predicted Mineral Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mineral" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['Gold', 'Silver', 'Copper', 'Iron', 'Lithium', 'Cobalt', 'Nickel', 'Zinc'].map(type => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confidence_score"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confidence Score (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="85"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expected_yield"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Yield</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select yield level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Very High">Very High</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="risk_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="recommendation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recommendation</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="AI recommendation for this site..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit">
                Create Prediction
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default PredictionForm;