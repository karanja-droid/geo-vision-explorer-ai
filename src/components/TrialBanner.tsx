import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Crown, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

export const TrialBanner: React.FC = () => {
  const { subscription, isTrialActive, getTrialDaysRemaining, isExpired } = useSubscription();
  const navigate = useNavigate();

  if (!subscription) return null;

  const daysRemaining = getTrialDaysRemaining();
  const trialActive = isTrialActive();
  const expired = isExpired();

  if (subscription.status === 'active') return null; // Don't show for active subscriptions

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  if (expired) {
    return (
      <Alert className="bg-destructive/10 border-destructive/20 mb-4">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-destructive font-medium">
              Trial Expired
            </span>
            <span className="text-muted-foreground">
              Your account is now in read-only mode. Upgrade to continue using all features.
            </span>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleUpgrade}
            className="ml-4 whitespace-nowrap"
          >
            <Crown className="h-4 w-4 mr-1" />
            Upgrade Now
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (trialActive) {
    const isUrgent = daysRemaining <= 3;
    
    return (
      <Alert className={`${isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'} mb-4`}>
        <Clock className={`h-4 w-4 ${isUrgent ? 'text-orange-500' : 'text-blue-500'}`} />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Badge variant={isUrgent ? "destructive" : "secondary"}>
              Free Trial
            </Badge>
            <span className={isUrgent ? 'text-orange-700' : 'text-blue-700'}>
              {daysRemaining === 1 ? '1 day' : `${daysRemaining} days`} remaining in your trial
            </span>
          </div>
          <Button 
            variant={isUrgent ? "default" : "outline"} 
            size="sm" 
            onClick={handleUpgrade}
            className="ml-4 whitespace-nowrap"
          >
            <Crown className="h-4 w-4 mr-1" />
            View Plans
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};