import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createSampleData } from '@/utils/sampleData';
import { createEnhancedSampleData } from '@/utils/enhancedSampleData';
import { Database, RefreshCw } from 'lucide-react';

interface SampleDataButtonProps {
  onDataCreated?: () => void;
  enhanced?: boolean;
}

const SampleDataButton: React.FC<SampleDataButtonProps> = ({ onDataCreated, enhanced = false }) => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateSampleData = async () => {
    try {
      setIsCreating(true);
      const result = enhanced ? await createEnhancedSampleData() : await createSampleData();
      
      toast({
        title: "Sample Data Created",
        description: enhanced 
          ? `Created ${result.totalRecords} records: ${result.projects.length} projects, ${result.sites.length} sites, ${result.deposits.length} deposits, ${result.predictions.length} predictions`
          : "AI models and projects have been created successfully",
      });
      
      onDataCreated?.();
    } catch (error) {
      console.error('Error creating sample data:', error);
      toast({
        title: "Error",
        description: "Failed to create sample data",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      onClick={handleCreateSampleData}
      disabled={isCreating}
      variant="outline"
      className="gap-2"
    >
      {isCreating ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <Database className="w-4 h-4" />
          {enhanced ? 'Create Enhanced ML Dataset' : 'Create Sample Data'}
        </>
      )}
    </Button>
  );
};

export default SampleDataButton;