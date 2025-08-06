import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Crown, ArrowRight } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  children, 
  fallback,
  showUpgrade = true 
}) => {
  const { canUseFeature, getFeature } = useFeatureFlags();
  const { subscription, isExpired } = useSubscription();
  const navigate = useNavigate();

  const featureData = getFeature(feature);
  const canAccess = canUseFeature(feature);

  if (canAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  const getRestrictionReason = () => {
    if (isExpired()) {
      return {
        title: 'Trial Expired',
        description: 'Your free trial has ended. Upgrade to continue using this feature.',
        action: 'Upgrade Now'
      };
    }

    if (!featureData) {
      return {
        title: 'Feature Not Available',
        description: 'This feature is not currently available.',
        action: null
      };
    }

    if (featureData.tier_restrictions && subscription) {
      const requiredTiers = featureData.tier_restrictions;
      const tierNames = {
        starter_team: 'Starter Team',
        corporate: 'Corporate',
        enterprise: 'Enterprise'
      };

      const requiredTierNames = requiredTiers
        .map(tier => tierNames[tier as keyof typeof tierNames])
        .filter(Boolean);

      return {
        title: 'Upgrade Required',
        description: `This feature requires ${requiredTierNames.join(' or ')} plan.`,
        action: 'View Plans'
      };
    }

    return {
      title: 'Feature Restricted',
      description: 'This feature is not available on your current plan.',
      action: 'View Plans'
    };
  };

  const restriction = getRestrictionReason();

  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="filter blur-sm pointer-events-none opacity-50">
        {children}
      </div>
      
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Alert className="max-w-md">
          <Lock className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <div className="font-semibold text-foreground">{restriction.title}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {restriction.description}
              </div>
            </div>
            
            {showUpgrade && restriction.action && (
              <Button onClick={handleUpgrade} className="w-full">
                <Crown className="h-4 w-4 mr-2" />
                {restriction.action}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};