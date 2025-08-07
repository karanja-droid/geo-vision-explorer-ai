import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BackupCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupCodes: string[];
}

export const BackupCodesModal: React.FC<BackupCodesModalProps> = ({
  isOpen,
  onClose,
  backupCodes
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      toast({
        title: "Backup codes copied",
        description: "Save these codes in a secure location",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please manually copy the codes",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    if (acknowledged) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Save Your Backup Codes
          </DialogTitle>
          <DialogDescription>
            These backup codes will allow you to access your account if you lose your authenticator device.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Important:</strong> Store these codes in a secure location. They will only be shown once.
            </AlertDescription>
          </Alert>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Backup Codes</label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!isVisible}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg font-mono text-sm">
              {isVisible ? (
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="p-2 bg-white dark:bg-slate-900 rounded border">
                      {code}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  Click the eye icon to reveal backup codes
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="acknowledge" className="text-sm">
              I have saved these backup codes in a secure location
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleClose}
              disabled={!acknowledged}
              className="w-full"
            >
              {acknowledged ? 'Continue' : 'Please acknowledge first'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};