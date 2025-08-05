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
import { useMineralDeposits, CreateMineralDepositData } from '@/hooks/useMineralDeposits';
import { Gem } from 'lucide-react';

const mineralDepositSchema = z.object({
  site_id: z.string().min(1, 'Site is required'),
  mineral_type: z.string().min(1, 'Mineral type is required'),
  grade_estimate: z.number().min(0).optional(),
  tonnage_estimate: z.number().min(0).optional(),
  confidence_level: z.number().min(0).max(100).optional(),
  discovery_date: z.string().optional(),
  notes: z.string().optional(),
});

interface MineralDepositFormProps {
  siteId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MineralDepositForm: React.FC<MineralDepositFormProps> = ({
  siteId,
  onSuccess,
  onCancel
}) => {
  const { createDeposit } = useMineralDeposits();

  const form = useForm<z.infer<typeof mineralDepositSchema>>({
    resolver: zodResolver(mineralDepositSchema),
    defaultValues: {
      site_id: siteId || '',
      mineral_type: '',
      grade_estimate: undefined,
      tonnage_estimate: undefined,
      confidence_level: undefined,
      discovery_date: '',
      notes: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof mineralDepositSchema>) => {
    try {
      if (!values.site_id || !values.mineral_type) {
        throw new Error('Site ID and mineral type are required');
      }
      
      const depositData: CreateMineralDepositData = {
        ...values,
        site_id: values.site_id,
        mineral_type: values.mineral_type,
        discovery_date: values.discovery_date || undefined,
      };
      
      await createDeposit(depositData);
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating mineral deposit:', error);
    }
  };

  const mineralTypes = [
    'Gold', 'Silver', 'Copper', 'Iron', 'Lithium', 'Cobalt', 
    'Nickel', 'Zinc', 'Lead', 'Platinum', 'Uranium', 'Coal'
  ];

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gem className="w-5 h-5" />
          Add Mineral Deposit
        </CardTitle>
        <CardDescription>
          Record a new mineral deposit discovery at an exploration site
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mineral_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mineral Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mineral type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mineralTypes.map(type => (
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
                name="confidence_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confidence Level (%)</FormLabel>
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
                name="grade_estimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade Estimate (g/t)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="2.5"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tonnage_estimate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tonnage Estimate (tonnes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1000000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="discovery_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discovery Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about the deposit..."
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
                Create Deposit
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default MineralDepositForm;