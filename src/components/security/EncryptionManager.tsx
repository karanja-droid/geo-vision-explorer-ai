import { useState } from 'react';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, Key, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';

const EncryptionManager = () => {
  const [keyRotationLoading, setKeyRotationLoading] = useState(false);
  const { toast } = useToast();

  const handleKeyRotation = async (forceRotation = false) => {
    setKeyRotationLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('encryption-key-rotation', {
        body: { force_rotation: forceRotation, dry_run: false }
      });
      
      if (error) throw error;
      
      toast({
        title: "Key Rotation Complete",
        description: `Successfully rotated ${data.total_rotated} encryption keys.`
      });
    } catch (error) {
      toast({
        title: "Key Rotation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
    setKeyRotationLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Encryption Key Management
        </CardTitle>
        <CardDescription>
          Manage financial data encryption and automated key rotation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Current Status</h4>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              AES-256 Encryption Active
            </Badge>
            <p className="text-sm text-muted-foreground">
              Budget data is automatically encrypted with 90-day key rotation
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Key Rotation</h4>
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={() => handleKeyRotation(false)}
                disabled={keyRotationLoading}
                size="sm"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {keyRotationLoading ? 'Rotating...' : 'Check & Rotate Keys'}
              </Button>
              <Button 
                onClick={() => handleKeyRotation(true)}
                disabled={keyRotationLoading}
                variant="outline"
                size="sm"
              >
                Force Rotation
              </Button>
            </div>
          </div>
        </div>
        
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Encryption keys are automatically rotated every 90 days. All budget data is encrypted at rest using strong AES-256 encryption.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default EncryptionManager;