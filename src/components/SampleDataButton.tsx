import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { createSampleData } from '@/utils/sampleData';
import { Database, RefreshCw } from 'lucide-react';

interface SampleDataButtonProps {
  onDataCreated?: () => void;
}

const SampleDataButton: React.FC<SampleDataButtonProps> = ({ onDataCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateSampleData = async () => {
    try {
      setIsCreating(true);
      await createSampleData();
      
      toast({
        title: "Sample Data Created",
        description: "AI models and projects have been created successfully",
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
          Create Sample Data
        </>
      )}
    </Button>
  );
};

export default SampleDataButton;