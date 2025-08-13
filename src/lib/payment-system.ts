import Stripe from 'stripe';
import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  currency: string;
  features: string[];
  limits: {
    projects: number;
    sites: number;
    users: number;
    storage: number; // in GB
    aiAnalyses: number;
    apiCalls: number;
  };
  isPopular?: boolean;
  isEnterprise?: boolean;
  stripeProductId: string;
  stripePriceId: string;
}

export interface Subscription {
  id: string;
  userId: string;
  organizationId?: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  dueDate: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
  invoicePdf?: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  amount: number;
  quantity: number;
  unitAmount: number;
}

export interface UsageRecord {
  subscriptionId: string;
  metricName: string;
  quantity: number;
  timestamp: Date;
  action: 'increment' | 'set';
}

export class PaymentManager {
  /**
   * Create a new customer in Stripe
   */
  async createCustomer(userId: string, email: string, name?: string): Promise<string> {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          userId
        }
      });

      // Store customer ID in database
      const { error } = await supabase
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to store customer ID: ${error.message}`);
      }

      return customer.id;
    } catch (error) {
      console.error('Failed to create customer:', error);
      throw error;
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string,
    trialDays?: number
  ): Promise<Subscription> {
    try {
      // Get or create customer
      let customerId = await this.getCustomerId(userId);
      if (!customerId) {
        const { data: user } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', userId)
          .single();
        
        if (!user) {
          throw new Error('User not found');
        }

        customerId = await this.createCustomer(userId, user.email, user.name);
      }

      // Get plan details
      const plan = await this.getSubscriptionPlan(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      // Attach payment method if provided
      if (paymentMethodId) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId
        });

        // Set as default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      }

      // Create subscription
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{
          price: plan.stripePriceId
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription'
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          planId
        }
      };

      if (trialDays) {
        subscriptionData.trial_period_days = trialDays;
      }

      const stripeSubscription = await stripe.subscriptions.create(subscriptionData);

      // Store subscription in database
      const subscription: Omit<Subscription, 'id'> = {
        userId,
        planId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId,
        status: stripeSubscription.status as Subscription['status'],
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : undefined,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { data, error } = await supabase
        .from('subscriptions')
        .insert(subscription)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to store subscription: ${error.message}`);
      }

      return this.mapSubscriptionFromDB(data);
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(subscriptionId: string, newPlanId: string): Promise<Subscription> {
    try {
      // Get current subscription
      const { data: currentSub, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (subError) {
        throw new Error(`Subscription not found: ${subError.message}`);
      }

      // Get new plan
      const newPlan = await this.getSubscriptionPlan(newPlanId);
      if (!newPlan) {
        throw new Error('New plan not found');
      }

      // Update Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
      
      await stripe.subscriptions.update(currentSub.stripe_subscription_id, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripePriceId
        }],
        proration_behavior: 'create_prorations'
      });

      // Update database
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          plan_id: newPlanId,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update subscription: ${error.message}`);
      }

      // Clear cache
      await this.clearSubscriptionCache(currentSub.user_id);

      return this.mapSubscriptionFromDB(data);
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, immediately: boolean = false): Promise<void> {
    try {
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (error) {
        throw new Error(`Subscription not found: ${error.message}`);
      }

      if (immediately) {
        // Cancel immediately
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', subscriptionId);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true
        });

        await supabase
          .from('subscriptions')
          .update({
            cancel_at_period_end: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscriptionId);
      }

      // Clear cache
      await this.clearSubscriptionCache(subscription.user_id);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling failed:', error);
      throw error;
    }
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const cacheKey = 'subscription_plans';
    const cached = await cacheManager.get<SubscriptionPlan[]>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch plans: ${error.message}`);
    }

    const plans = data.map(this.mapPlanFromDB);
    await cacheManager.set(cacheKey, plans, 3600); // 1 hour

    return plans;
  }

  /**
   * Get user's current subscription
   */
  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    const cacheKey = `user_subscription_${userId}`;
    const cached = await cacheManager.get<Subscription>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }

    const subscription = this.mapSubscriptionFromDB(data);
    await cacheManager.set(cacheKey, subscription, 300); // 5 minutes

    return subscription;
  }

  /**
   * Check feature access
   */
  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      
      if (!subscription) {
        // Check if user has free tier access
        return this.checkFreeTierAccess(feature);
      }

      const plan = await this.getSubscriptionPlan(subscription.planId);
      if (!plan) return false;

      return plan.features.includes(feature);
    } catch (error) {
      console.error('Failed to check feature access:', error);
      return false;
    }
  }

  /**
   * Check usage limits
   */
  async checkUsageLimit(userId: string, metric: keyof SubscriptionPlan['limits']): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
  }> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      const plan = subscription 
        ? await this.getSubscriptionPlan(subscription.planId)
        : await this.getFreeTierPlan();

      if (!plan) {
        return { allowed: false, current: 0, limit: 0 };
      }

      const currentUsage = await this.getCurrentUsage(userId, metric);
      const limit = plan.limits[metric];

      return {
        allowed: currentUsage < limit,
        current: currentUsage,
        limit
      };
    } catch (error) {
      console.error('Failed to check usage limit:', error);
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  /**
   * Record usage
   */
  async recordUsage(userId: string, metric: string, quantity: number = 1): Promise<void> {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      if (!subscription) return;

      // Record in database
      await supabase
        .from('usage_records')
        .insert({
          user_id: userId,
          subscription_id: subscription.id,
          metric_name: metric,
          quantity,
          timestamp: new Date().toISOString()
        });

      // Report to Stripe if it's a metered billing item
      const plan = await this.getSubscriptionPlan(subscription.planId);
      if (plan?.stripePriceId && this.isMeteredBilling(plan.stripePriceId)) {
        await this.reportUsageToStripe(subscription.stripeSubscriptionId, metric, quantity);
      }
    } catch (error) {
      console.error('Failed to record usage:', error);
    }
  }

  /**
   * Generate invoice
   */
  async generateInvoice(customerId: string): Promise<Invoice> {
    try {
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: false
      });

      await stripe.invoices.finalizeInvoice(invoice.id);

      return this.mapInvoiceFromStripe(invoice);
    } catch (error) {
      console.error('Failed to generate invoice:', error);
      throw error;
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const customerId = await this.getCustomerId(userId);
      if (!customerId) return [];

      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      const defaultPaymentMethodId = customer.invoice_settings.default_payment_method as string;

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type as 'card',
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : undefined,
        isDefault: pm.id === defaultPaymentMethodId
      }));
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      return [];
    }
  }

  // Private helper methods
  private async getCustomerId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error || !data?.stripe_customer_id) return null;
    return data.stripe_customer_id;
  }

  private async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    const cacheKey = `subscription_plan_${planId}`;
    const cached = await cacheManager.get<SubscriptionPlan>(cacheKey);
    
    if (cached) return cached;

    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) return null;

    const plan = this.mapPlanFromDB(data);
    await cacheManager.set(cacheKey, plan, 3600);

    return plan;
  }

  private async getFreeTierPlan(): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', 'free')
      .single();

    if (error) return null;
    return this.mapPlanFromDB(data);
  }

  private checkFreeTierAccess(feature: string): boolean {
    const freeTierFeatures = [
      'basic_geological_analysis',
      'project_management',
      'basic_mapping',
      'data_export'
    ];
    
    return freeTierFeatures.includes(feature);
  }

  private async getCurrentUsage(userId: string, metric: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('usage_records')
      .select('quantity')
      .eq('user_id', userId)
      .eq('metric_name', metric)
      .gte('timestamp', startOfMonth.toISOString());

    if (error) return 0;

    return data.reduce((sum, record) => sum + record.quantity, 0);
  }

  private isMeteredBilling(priceId: string): boolean {
    // Check if this price ID is for metered billing
    // This would be configured in your Stripe dashboard
    const meteredPrices = ['price_metered_api_calls', 'price_metered_ai_analyses'];
    return meteredPrices.includes(priceId);
  }

  private async reportUsageToStripe(subscriptionId: string, metric: string, quantity: number): Promise<void> {
    try {
      // Get subscription item ID for the metric
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subscriptionItem = subscription.items.data.find(item => 
        item.price.nickname === metric
      );

      if (subscriptionItem) {
        await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
          quantity,
          timestamp: Math.floor(Date.now() / 1000),
          action: 'increment'
        });
      }
    } catch (error) {
      console.error('Failed to report usage to Stripe:', error);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Failed to update subscription:', error);
    }

    // Clear cache
    if (subscription.metadata?.userId) {
      await this.clearSubscriptionCache(subscription.metadata.userId);
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) {
      console.error('Failed to handle subscription deletion:', error);
    }

    // Clear cache
    if (subscription.metadata?.userId) {
      await this.clearSubscriptionCache(subscription.metadata.userId);
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    // Store payment record
    const { error } = await supabase
      .from('payments')
      .insert({
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent as string,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: 'succeeded',
        paid_at: new Date(invoice.status_transitions.paid_at! * 1000).toISOString()
      });

    if (error) {
      console.error('Failed to store payment record:', error);
    }

    // Send payment confirmation email
    if (invoice.customer_email) {
      await this.sendPaymentConfirmationEmail(invoice.customer_email, invoice);
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Store failed payment record
    const { error } = await supabase
      .from('payments')
      .insert({
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
        status: 'failed'
      });

    if (error) {
      console.error('Failed to store failed payment record:', error);
    }

    // Send payment failure notification
    if (invoice.customer_email) {
      await this.sendPaymentFailureEmail(invoice.customer_email, invoice);
    }
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    // Send trial ending notification
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    
    if (customer.email) {
      await this.sendTrialEndingEmail(customer.email, subscription);
    }
  }

  private async sendPaymentConfirmationEmail(email: string, invoice: Stripe.Invoice): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Sending payment confirmation to ${email} for invoice ${invoice.id}`);
  }

  private async sendPaymentFailureEmail(email: string, invoice: Stripe.Invoice): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Sending payment failure notification to ${email} for invoice ${invoice.id}`);
  }

  private async sendTrialEndingEmail(email: string, subscription: Stripe.Subscription): Promise<void> {
    // Implementation would depend on your email service
    console.log(`Sending trial ending notification to ${email} for subscription ${subscription.id}`);
  }

  private async clearSubscriptionCache(userId: string): Promise<void> {
    await cacheManager.delete(`user_subscription_${userId}`);
  }

  private mapPlanFromDB(data: any): SubscriptionPlan {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      interval: data.interval,
      currency: data.currency,
      features: data.features,
      limits: data.limits,
      isPopular: data.is_popular,
      isEnterprise: data.is_enterprise,
      stripeProductId: data.stripe_product_id,
      stripePriceId: data.stripe_price_id
    };
  }

  private mapSubscriptionFromDB(data: any): Subscription {
    return {
      id: data.id,
      userId: data.user_id,
      organizationId: data.organization_id,
      planId: data.plan_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      stripeCustomerId: data.stripe_customer_id,
      status: data.status,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      cancelAtPeriodEnd: data.cancel_at_period_end,
      canceledAt: data.canceled_at ? new Date(data.canceled_at) : undefined,
      trialStart: data.trial_start ? new Date(data.trial_start) : undefined,
      trialEnd: data.trial_end ? new Date(data.trial_end) : undefined,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapInvoiceFromStripe(invoice: Stripe.Invoice): Invoice {
    return {
      id: invoice.id,
      subscriptionId: invoice.subscription as string,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: invoice.status as Invoice['status'],
      dueDate: new Date(invoice.due_date! * 1000),
      paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : undefined,
      hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
      invoicePdf: invoice.invoice_pdf || undefined,
      items: invoice.lines.data.map(line => ({
        description: line.description || '',
        amount: line.amount / 100,
        quantity: line.quantity || 1,
        unitAmount: line.amount / 100 / (line.quantity || 1)
      }))
    };
  }
}

// Subscription Manager for higher-level operations
export class SubscriptionManager {
  private paymentManager = new PaymentManager();

  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return this.paymentManager.getSubscriptionPlans();
  }

  async getCurrentPlan(userId: string): Promise<SubscriptionPlan | null> {
    const subscription = await this.paymentManager.getCurrentSubscription(userId);
    if (!subscription) return null;

    return this.paymentManager.getSubscriptionPlan(subscription.planId);
  }

  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    return this.paymentManager.checkFeatureAccess(userId, feature);
  }

  async handlePlanChange(userId: string, newPlanId: string): Promise<void> {
    const currentSubscription = await this.paymentManager.getCurrentSubscription(userId);
    
    if (!currentSubscription) {
      // Create new subscription
      await this.paymentManager.createSubscription(userId, newPlanId);
    } else {
      // Update existing subscription
      await this.paymentManager.updateSubscription(currentSubscription.id, newPlanId);
    }
  }

  async processPaymentFailure(subscriptionId: string): Promise<void> {
    // Implement dunning management logic
    console.log(`Processing payment failure for subscription ${subscriptionId}`);
    
    // This would typically involve:
    // 1. Retry payment with different payment methods
    // 2. Send dunning emails
    // 3. Downgrade or suspend service after grace period
    // 4. Update subscription status
  }
}

// Export instances
export const paymentManager = new PaymentManager();
export const subscriptionManager = new SubscriptionManager();

// React hooks
export function useSubscription(userId: string) {
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [plan, setPlan] = React.useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;

    const fetchSubscription = async () => {
      try {
        const sub = await paymentManager.getCurrentSubscription(userId);
        setSubscription(sub);
        
        if (sub) {
          const planData = await subscriptionManager.getCurrentPlan(userId);
          setPlan(planData);
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [userId]);

  const checkFeatureAccess = async (feature: string) => {
    return subscriptionManager.checkFeatureAccess(userId, feature);
  };

  const changePlan = async (newPlanId: string) => {
    await subscriptionManager.handlePlanChange(userId, newPlanId);
    // Refresh subscription data
    const sub = await paymentManager.getCurrentSubscription(userId);
    setSubscription(sub);
    
    if (sub) {
      const planData = await subscriptionManager.getCurrentPlan(userId);
      setPlan(planData);
    }
  };

  return {
    subscription,
    plan,
    loading,
    checkFeatureAccess,
    changePlan
  };
}