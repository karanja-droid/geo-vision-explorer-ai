import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Users, Building, Briefcase } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  price: number;
  billing: 'monthly' | 'annual';
  icon: React.ReactNode;
  popular?: boolean;
  features: string[];
  limits: {
    users: number;
    ai_runs: number;
    map_tiles: number;
    gee_hours: number;
    storage_gb: number;
  };
}

const pricingTiers: PricingTier[] = [
  {
    id: 'individual',
    name: 'Individual',
    description: 'Perfect for individual geologists and consultants',
    price: 49,
    billing: 'monthly',
    icon: <Crown className="h-6 w-6" />,
    features: [
      'Core exploration tools',
      '2D mapping & visualization',
      'Basic reporting',
      'Email support',
      'Data export (CSV, shapefile)'
    ],
    limits: {
      users: 1,
      ai_runs: 5,
      map_tiles: 100000,
      gee_hours: 10,
      storage_gb: 5
    }
  },
  {
    id: 'starter_team',
    name: 'Starter Team',
    description: 'Great for small exploration teams',
    price: 299,
    billing: 'monthly',
    icon: <Users className="h-6 w-6" />,
    popular: true,
    features: [
      'Everything in Individual',
      'Real-time collaboration',
      'Advanced reporting & dashboards',
      '3D visualization',
      'Priority support',
      'Team management',
      'Advanced exports (GeoTIFF)'
    ],
    limits: {
      users: 5,
      ai_runs: 30,
      map_tiles: 500000,
      gee_hours: 50,
      storage_gb: 50
    }
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'For mining companies and large teams',
    price: 999,
    billing: 'monthly',
    icon: <Building className="h-6 w-6" />,
    features: [
      'Everything in Starter Team',
      'Drill management & planning',
      'Lab workflow & LIMS integration',
      'Advanced AI prospectivity',
      'Custom reporting templates',
      'API access',
      'Phone support',
      'SSO integration'
    ],
    limits: {
      users: 20,
      ai_runs: 100,
      map_tiles: 2000000,
      gee_hours: 200,
      storage_gb: 200
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solution for large organizations',
    price: 0, // Custom pricing
    billing: 'monthly',
    icon: <Briefcase className="h-6 w-6" />,
    features: [
      'Everything in Corporate',
      'Resource estimation & modeling',
      'Environmental & safety modules',
      'Custom integrations',
      'Dedicated account manager',
      'On-premise deployment option',
      'Custom training',
      'SLA guarantee',
      'Unlimited everything'
    ],
    limits: {
      users: -1, // Unlimited
      ai_runs: -1,
      map_tiles: -1,
      gee_hours: -1,
      storage_gb: -1
    }
  }
];

export const PricingPage: React.FC = () => {
  const { subscription, isTrialActive, getTrialDaysRemaining } = useSubscription();
  const { user } = useAuth();

  const handleUpgrade = async (tierId: string) => {
    if (tierId === 'enterprise') {
      // Redirect to contact sales
      window.open('mailto:sales@geovision-ai.com?subject=Enterprise Inquiry', '_blank');
      return;
    }

    // For now, just show a placeholder - would integrate with Stripe in production
    console.log('Upgrading to:', tierId);
    alert(`Upgrade to ${tierId} - Stripe integration would be implemented here`);
  };

  const formatPrice = (price: number) => {
    return price === 0 ? 'Custom' : `$${price}`;
  };

  const formatLimit = (value: number, unit: string) => {
    if (value === -1) return 'Unlimited';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M ${unit}`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K ${unit}`;
    return `${value} ${unit}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Choose Your Plan
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Start with a 30-day free trial. Upgrade anytime to unlock more features and increase your limits.
        </p>
        
        {isTrialActive() && (
          <div className="mt-6">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {getTrialDaysRemaining()} days left in your free trial
            </Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {pricingTiers.map((tier) => (
          <Card 
            key={tier.id} 
            className={`relative ${tier.popular ? 'border-primary shadow-lg scale-105' : ''} ${
              subscription?.tier === tier.id ? 'ring-2 ring-primary' : ''
            }`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                {tier.icon}
              </div>
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{formatPrice(tier.price)}</span>
                {tier.price > 0 && <span className="text-muted-foreground">/month</span>}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Usage Limits</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>👥 {formatLimit(tier.limits.users, 'users')}</div>
                  <div>🤖 {formatLimit(tier.limits.ai_runs, 'AI runs/month')}</div>
                  <div>🗺️ {formatLimit(tier.limits.map_tiles, 'map tiles/month')}</div>
                  <div>🛰️ {formatLimit(tier.limits.gee_hours, 'GEE hours/month')}</div>
                  <div>💾 {formatLimit(tier.limits.storage_gb, 'GB storage')}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Features</h4>
                <ul className="space-y-1">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="h-4 w-4 text-primary mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4">
                <Button 
                  className="w-full"
                  variant={subscription?.tier === tier.id ? "outline" : "default"}
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={subscription?.tier === tier.id}
                >
                  {subscription?.tier === tier.id ? 'Current Plan' : 
                   tier.price === 0 ? 'Contact Sales' : 'Upgrade'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold">Frequently Asked Questions</h3>
        <div className="max-w-2xl mx-auto space-y-4 text-left">
          <div>
            <h4 className="font-semibold">What happens when my trial ends?</h4>
            <p className="text-muted-foreground">
              Your account switches to read-only mode. You can still view your data but won't be able to create new projects or run AI analysis.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">Can I change plans anytime?</h4>
            <p className="text-muted-foreground">
              Yes! You can upgrade or downgrade your plan at any time. Changes are prorated and take effect immediately.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">What payment methods do you accept?</h4>
            <p className="text-muted-foreground">
              We accept all major credit cards and offer annual billing with a 10% discount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};