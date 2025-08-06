import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

interface Subscription {
  id: string;
  user_id: string;
  tier: 'individual' | 'starter_team' | 'corporate' | 'enterprise';
  status: string;
  trial_start_date: string;
  trial_end_date: string;
  billing_cycle: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

interface UsageMetric {
  metric_type: string;
  amount: number;
  period_start: string;
  period_end: string;
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetric[]>([]);
  const [loading, setLoading] = useState(true);

  // Tier limits configuration
  const tierLimits = {
    individual: {
      ai_runs: 5,
      map_tiles: 100000,
      gee_hours: 10,
      bigquery_gb: 1
    },
    starter_team: {
      ai_runs: 30,
      map_tiles: 500000,
      gee_hours: 50,
      bigquery_gb: 10
    },
    corporate: {
      ai_runs: 100,
      map_tiles: 2000000,
      gee_hours: 200,
      bigquery_gb: 100
    },
    enterprise: {
      ai_runs: -1, // Unlimited
      map_tiles: -1,
      gee_hours: -1,
      bigquery_gb: -1
    }
  };

  // Fetch subscription details
  const fetchSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  // Fetch current usage metrics
  const fetchUsage = async () => {
    if (!user) return;

    try {
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('usage_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('period_start', startOfMonth.toISOString())
        .lte('period_end', endOfMonth.toISOString());

      if (error) throw error;
      setUsage(data || []);
    } catch (error) {
      console.error('Error fetching usage:', error);
    }
  };

  // Initialize subscription for new users
  const initializeSubscription = async () => {
    if (!user) return;

    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          tier: 'individual',
          status: 'trial',
          trial_start_date: new Date().toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          billing_cycle: 'monthly'
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        throw error;
      }

      if (data) {
        setSubscription(data);
        toast({
          title: "Welcome to GeoVision AI Miner!",
          description: "Your 30-day trial has started. Enjoy full access to all features.",
        });
      }
    } catch (error) {
      console.error('Error initializing subscription:', error);
    }
  };

  // Record usage
  const recordUsage = async (metricType: string, amount: number, metadata?: any) => {
    if (!user) return;

    try {
      const now = new Date();
      const { error } = await supabase
        .from('usage_metrics')
        .insert({
          user_id: user.id,
          metric_type: metricType,
          amount,
          period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
          metadata
        });

      if (error) throw error;
      
      // Refresh usage data
      fetchUsage();
    } catch (error) {
      console.error('Error recording usage:', error);
    }
  };

  // Check if user can use a feature based on usage limits
  const canUseFeature = (metricType: string): boolean => {
    if (!subscription) return true; // Allow during trial initialization

    // Check if trial is active
    if (subscription.status === 'trial') {
      const trialEnd = new Date(subscription.trial_end_date);
      if (new Date() < trialEnd) return true;
      
      // Trial expired, switch to read-only mode
      return false;
    }

    // Check subscription status
    if (subscription.status !== 'active') return false;

    // Check usage limits
    const limits = tierLimits[subscription.tier];
    const limit = limits[metricType as keyof typeof limits];
    
    if (limit === -1) return true; // Unlimited

    const currentUsage = usage
      .filter(u => u.metric_type === metricType)
      .reduce((total, u) => total + u.amount, 0);

    return currentUsage < limit;
  };

  // Get usage summary
  const getUsageSummary = () => {
    if (!subscription) return {};

    const limits = tierLimits[subscription.tier];
    const summary: Record<string, { used: number; limit: number; percentage: number }> = {};

    Object.keys(limits).forEach(metricType => {
      const used = usage
        .filter(u => u.metric_type === metricType)
        .reduce((total, u) => total + u.amount, 0);
      
      const limit = limits[metricType as keyof typeof limits];
      const percentage = limit === -1 ? 0 : (used / limit) * 100;

      summary[metricType] = { used, limit, percentage };
    });

    return summary;
  };

  // Check if trial is active
  const isTrialActive = (): boolean => {
    if (!subscription || subscription.status !== 'trial') return false;
    
    const trialEnd = new Date(subscription.trial_end_date);
    return new Date() < trialEnd;
  };

  // Get trial days remaining
  const getTrialDaysRemaining = (): number => {
    if (!subscription || subscription.status !== 'trial') return 0;
    
    const trialEnd = new Date(subscription.trial_end_date);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  // Check if subscription is expired
  const isExpired = (): boolean => {
    if (!subscription) return false;
    
    if (subscription.status === 'trial') {
      const trialEnd = new Date(subscription.trial_end_date);
      return new Date() >= trialEnd;
    }
    
    return subscription.status === 'expired' || subscription.status === 'cancelled';
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      await fetchSubscription();
      await fetchUsage();
      setLoading(false);
    };

    loadData();
  }, [user]);

  // Initialize subscription for new users
  useEffect(() => {
    if (user && !loading && !subscription) {
      initializeSubscription();
    }
  }, [user, loading, subscription]);

  return {
    subscription,
    usage,
    loading,
    canUseFeature,
    recordUsage,
    getUsageSummary,
    isTrialActive,
    getTrialDaysRemaining,
    isExpired,
    tierLimits,
    refetch: () => {
      fetchSubscription();
      fetchUsage();
    }
  };
};