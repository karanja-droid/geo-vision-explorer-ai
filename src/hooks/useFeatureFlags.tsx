import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  module: string;
  enabled: boolean;
  tier_restrictions: string[] | null;
  user_restrictions: string[] | null;
  metadata: any;
}

interface Subscription {
  tier: string;
  status: string;
  trial_end_date: string;
}

export const useFeatureFlags = () => {
  const { user } = useAuth();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch feature flags
  const fetchFeatureFlags = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;
      setFeatureFlags(data || []);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
    }
  };

  // Fetch user subscription
  const fetchSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, status, trial_end_date')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  // Check if feature is enabled for current user
  const isFeatureEnabled = (featureName: string): boolean => {
    const flag = featureFlags.find(f => f.name === featureName);
    if (!flag || !flag.enabled) return false;

    // Check user restrictions
    if (flag.user_restrictions && user) {
      if (!flag.user_restrictions.includes(user.id)) return false;
    }

    // Check tier restrictions
    if (flag.tier_restrictions && subscription) {
      if (!flag.tier_restrictions.includes(subscription.tier)) return false;
    }

    return true;
  };

  // Check if user is in trial period
  const isInTrial = (): boolean => {
    if (!subscription) return true; // Default to trial for new users
    
    if (subscription.status === 'trial' && subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      return new Date() < trialEnd;
    }
    
    return false;
  };

  // Get days remaining in trial
  const getTrialDaysRemaining = (): number => {
    if (!subscription?.trial_end_date) return 30; // Default trial period
    
    const trialEnd = new Date(subscription.trial_end_date);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  // Check if feature is available considering trial status
  const canUseFeature = (featureName: string): boolean => {
    if (isInTrial()) return true; // All features available during trial
    
    if (subscription?.status === 'active') {
      return isFeatureEnabled(featureName);
    }
    
    // Trial expired, only basic features available
    const basicFeatures = ['exploration_core', '2d_visualization'];
    return basicFeatures.includes(featureName);
  };

  // Get feature by name
  const getFeature = (featureName: string): FeatureFlag | null => {
    return featureFlags.find(f => f.name === featureName) || null;
  };

  // Get features by module
  const getFeaturesByModule = (module: string): FeatureFlag[] => {
    return featureFlags.filter(f => f.module === module);
  };

  // Initialize subscription for new users
  const initializeSubscription = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          tier: 'individual',
          status: 'trial',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (error && error.code !== '23505') { // Ignore duplicate key error
        console.error('Error initializing subscription:', error);
      } else {
        fetchSubscription(); // Refetch after creation
      }
    } catch (error) {
      console.error('Error initializing subscription:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchFeatureFlags(),
        fetchSubscription()
      ]);
      setLoading(false);
    };

    loadData();

    // Initialize subscription for new users
    if (user && !subscription) {
      initializeSubscription();
    }
  }, [user]);

  return {
    featureFlags,
    subscription,
    loading,
    isFeatureEnabled,
    canUseFeature,
    isInTrial,
    getTrialDaysRemaining,
    getFeature,
    getFeaturesByModule,
    refetch: () => {
      fetchFeatureFlags();
      fetchSubscription();
    }
  };
};