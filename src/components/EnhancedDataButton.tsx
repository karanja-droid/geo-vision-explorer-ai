import React from 'react';
import SampleDataButton from './SampleDataButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface EnhancedDataButtonProps {
  onDataCreated?: () => void;
}

const EnhancedDataButton: React.FC<EnhancedDataButtonProps> = ({ onDataCreated }) => {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sample Data Generation</CardTitle>
        <CardDescription>
          Generate realistic geological data for ML training and testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h4 className="font-medium">Basic Sample Data</h4>
            <p className="text-sm text-muted-foreground">
              Create a small dataset with 2 projects and basic exploration data
            </p>
            <SampleDataButton onDataCreated={onDataCreated} />
          </div>
          
          <Separator orientation="vertical" className="hidden md:block" />
          
          <div className="space-y-2">
            <h4 className="font-medium">Enhanced ML Dataset</h4>
            <p className="text-sm text-muted-foreground">
              Generate 1000+ records with real geological data from major mining regions in Africa and America
            </p>
            <SampleDataButton enhanced onDataCreated={onDataCreated} />
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <h5 className="font-medium mb-2">Enhanced Dataset Features:</h5>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 20 projects from major mining regions (Witwatersrand, Carlin Trend, Atacama, etc.)</li>
            <li>• 200+ exploration sites with realistic coordinates and geology</li>
            <li>• 500+ mineral deposits with authentic grade-tonnage data</li>
            <li>• 300+ AI predictions with geological insights</li>
            <li>• Advanced AI models trained on regional datasets</li>
            <li>• Real geochemical data and geological formations</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedDataButton;