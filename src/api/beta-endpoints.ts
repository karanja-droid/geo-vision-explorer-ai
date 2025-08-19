/**
 * GeoVision AI Miner - Beta Testing API Endpoints
 * 
 * This file contains API endpoints for beta testing functionality including:
 * - Beta user management
 * - Feedback collection
 * - Performance metrics
 * - Analytics dashboard
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface BetaUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  company: string;
  experience_level: 'junior' | 'senior' | 'expert';
  beta_phase: 'closed' | 'extended' | 'open';
  status: 'invited' | 'active' | 'completed' | 'churned';
  signup_date: string;
  last_active?: string;
  feedback_score?: number;
  feature_usage: Record<string, number>;
}

interface BetaFeedback {
  id: string;
  user_id: string;
  feature_name: string;
  satisfaction_score: number;
  usage_frequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
  feedback_text: string;
  feedback_type: 'general' | 'bug' | 'improvement' | 'praise';
  improvement_suggestion?: string;
  bug_description?: string;
  timestamp: string;
}

interface BetaMetrics {
  id: string;
  user_id: string;
  session_id: string;
  feature_name: string;
  action_type: 'view' | 'click' | 'form_submit' | 'api_call' | 'error';
  response_time_ms?: number;
  error_message?: string;
  timestamp: string;
  metadata: Record<string, any>;
}

/**
 * Beta Users API Endpoints
 */
export class BetaUsersAPI {
  
  // Get beta users with optional filtering
  static async getUsers(phase?: string, status?: string): Promise<BetaUser[]> {
    let query = supabase.from('beta_users').select('*');
    
    if (phase && phase !== 'all') {
      query = query.eq('beta_phase', phase);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query.order('signup_date', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch beta users: ${error.message}`);
    }
    
    return data || [];
  }
  
  // Create new beta user
  static async createUser(userData: Partial<BetaUser>): Promise<BetaUser> {
    const { data, error } = await supabase
      .from('beta_users')
      .insert([{
        ...userData,
        signup_date: new Date().toISOString(),
        status: 'invited',
        feature_usage: {}
      }])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create beta user: ${error.message}`);
    }
    
    return data;
  }
  
  // Update beta user status
  static async updateUserStatus(userId: string, status: BetaUser['status']): Promise<void> {
    const { error } = await supabase
      .from('beta_users')
      .update({ 
        status,
        last_active: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) {
      throw new Error(`Failed to update user status: ${error.message}`);
    }
  }
  
  // Track feature usage
  static async trackFeatureUsage(userId: string, featureName: string): Promise<void> {
    // Get current usage
    const { data: user } = await supabase
      .from('beta_users')
      .select('feature_usage')
      .eq('id', userId)
      .single();
    
    if (user) {
      const currentUsage = user.feature_usage || {};
      currentUsage[featureName] = (currentUsage[featureName] || 0) + 1;
      
      const { error } = await supabase
        .from('beta_users')
        .update({ 
          feature_usage: currentUsage,
          last_active: new Date().toISOString()
        })
        .eq('id', userId);
      
      if (error) {
        throw new Error(`Failed to track feature usage: ${error.message}`);
      }
    }
  }
}

/**
 * Beta Feedback API Endpoints
 */
export class BetaFeedbackAPI {
  
  // Get feedback with optional filtering
  static async getFeedback(timeRange?: string, featureName?: string): Promise<BetaFeedback[]> {
    let query = supabase.from('beta_feedback').select('*');
    
    if (timeRange) {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte('timestamp', startDate.toISOString());
    }
    
    if (featureName) {
      query = query.eq('feature_name', featureName);
    }
    
    const { data, error } = await query.order('timestamp', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }
    
    return data || [];
  }
  
  // Submit new feedback
  static async submitFeedback(feedbackData: Partial<BetaFeedback>): Promise<BetaFeedback> {
    const { data, error } = await supabase
      .from('beta_feedback')
      .insert([{
        ...feedbackData,
        timestamp: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }
    
    // Update user's average feedback score
    if (feedbackData.user_id && feedbackData.satisfaction_score) {
      await this.updateUserFeedbackScore(feedbackData.user_id);
    }
    
    return data;
  }
  
  // Update user's average feedback score
  private static async updateUserFeedbackScore(userId: string): Promise<void> {
    const { data: feedbacks } = await supabase
      .from('beta_feedback')
      .select('satisfaction_score')
      .eq('user_id', userId);
    
    if (feedbacks && feedbacks.length > 0) {
      const averageScore = feedbacks.reduce((sum, f) => sum + f.satisfaction_score, 0) / feedbacks.length;
      
      await supabase
        .from('beta_users')
        .update({ feedback_score: Math.round(averageScore * 100) / 100 })
        .eq('id', userId);
    }
  }
  
  // Get feedback summary by feature
  static async getFeedbackSummary(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('beta_feedback')
      .select('feature_name, satisfaction_score, feedback_type');
    
    if (error) {
      throw new Error(`Failed to get feedback summary: ${error.message}`);
    }
    
    const summary: Record<string, any> = {};
    
    data?.forEach(feedback => {
      if (!summary[feedback.feature_name]) {
        summary[feedback.feature_name] = {
          total_feedback: 0,
          average_score: 0,
          scores: [],
          feedback_types: { general: 0, bug: 0, improvement: 0, praise: 0 }
        };
      }
      
      summary[feedback.feature_name].total_feedback++;
      summary[feedback.feature_name].scores.push(feedback.satisfaction_score);
      summary[feedback.feature_name].feedback_types[feedback.feedback_type]++;
    });
    
    // Calculate averages
    Object.keys(summary).forEach(feature => {
      const scores = summary[feature].scores;
      summary[feature].average_score = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    });
    
    return summary;
  }
}

/**
 * Beta Metrics API Endpoints
 */
export class BetaMetricsAPI {
  
  // Track user action/event
  static async trackEvent(eventData: Partial<BetaMetrics>): Promise<void> {
    const { error } = await supabase
      .from('beta_metrics')
      .insert([{
        ...eventData,
        timestamp: new Date().toISOString()
      }]);
    
    if (error) {
      throw new Error(`Failed to track event: ${error.message}`);
    }
  }
  
  // Get performance metrics
  static async getPerformanceMetrics(timeRange?: string): Promise<BetaMetrics[]> {
    let query = supabase.from('beta_metrics').select('*');
    
    if (timeRange) {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte('timestamp', startDate.toISOString());
    }
    
    const { data, error } = await query.order('timestamp', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
    
    return data || [];
  }
  
  // Get response time statistics
  static async getResponseTimeStats(): Promise<any> {
    const { data, error } = await supabase
      .from('beta_metrics')
      .select('response_time_ms')
      .not('response_time_ms', 'is', null);
    
    if (error) {
      throw new Error(`Failed to get response time stats: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return { average: 0, p95: 0, p99: 0, total: 0 };
    }
    
    const times = data.map(d => d.response_time_ms).sort((a, b) => a - b);
    const total = times.length;
    const average = times.reduce((a, b) => a + b, 0) / total;
    const p95 = times[Math.floor(total * 0.95)];
    const p99 = times[Math.floor(total * 0.99)];
    
    return {
      average: Math.round(average),
      p95,
      p99,
      total,
      fast_requests: times.filter(t => t < 2000).length,
      slow_requests: times.filter(t => t >= 2000).length
    };
  }
  
  // Get error rate statistics
  static async getErrorStats(): Promise<any> {
    const { data: totalEvents } = await supabase
      .from('beta_metrics')
      .select('id', { count: 'exact' });
    
    const { data: errorEvents } = await supabase
      .from('beta_metrics')
      .select('id', { count: 'exact' })
      .eq('action_type', 'error');
    
    const total = totalEvents?.length || 0;
    const errors = errorEvents?.length || 0;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;
    
    return {
      total_events: total,
      error_events: errors,
      error_rate: Math.round(errorRate * 100) / 100,
      success_rate: Math.round((100 - errorRate) * 100) / 100
    };
  }
}

/**
 * Beta Analytics API Endpoints
 */
export class BetaAnalyticsAPI {
  
  // Get comprehensive beta analytics
  static async getAnalytics(): Promise<any> {
    try {
      // Get user distribution
      const users = await BetaUsersAPI.getUsers();
      const userDistribution = this.calculateUserDistribution(users);
      
      // Get satisfaction scores
      const feedback = await BetaFeedbackAPI.getFeedback();
      const satisfactionScores = this.calculateSatisfactionScores(feedback);
      
      // Get performance metrics
      const responseTimeStats = await BetaMetricsAPI.getResponseTimeStats();
      const errorStats = await BetaMetricsAPI.getErrorStats();
      
      // Get feature adoption
      const feedbackSummary = await BetaFeedbackAPI.getFeedbackSummary();
      const featureAdoption = Object.keys(feedbackSummary).reduce((acc, feature) => {
        acc[feature] = feedbackSummary[feature].total_feedback;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        user_distribution: userDistribution,
        satisfaction_scores: satisfactionScores,
        performance_metrics: {
          ...responseTimeStats,
          ...errorStats
        },
        feature_adoption: featureAdoption,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Failed to get analytics: ${error}`);
    }
  }
  
  private static calculateUserDistribution(users: BetaUser[]) {
    const distribution = {
      by_role: {} as Record<string, number>,
      by_phase: {} as Record<string, number>,
      by_experience: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      total_users: users.length
    };
    
    users.forEach(user => {
      distribution.by_role[user.role] = (distribution.by_role[user.role] || 0) + 1;
      distribution.by_phase[user.beta_phase] = (distribution.by_phase[user.beta_phase] || 0) + 1;
      distribution.by_experience[user.experience_level] = (distribution.by_experience[user.experience_level] || 0) + 1;
      distribution.by_status[user.status] = (distribution.by_status[user.status] || 0) + 1;
    });
    
    return distribution;
  }
  
  private static calculateSatisfactionScores(feedback: BetaFeedback[]) {
    const scores = feedback.map(f => f.satisfaction_score).filter(s => s);
    
    if (scores.length === 0) {
      return {
        average_score: 0,
        total_responses: 0,
        score_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }
    
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      average_score: Math.round(average * 100) / 100,
      total_responses: scores.length,
      score_distribution: {
        1: scores.filter(s => s === 1).length,
        2: scores.filter(s => s === 2).length,
        3: scores.filter(s => s === 3).length,
        4: scores.filter(s => s === 4).length,
        5: scores.filter(s => s === 5).length
      }
    };
  }
  
  // Get beta testing KPIs
  static async getKPIs(): Promise<any> {
    const analytics = await this.getAnalytics();
    
    const satisfactionRate = (analytics.satisfaction_scores.average_score / 5) * 100;
    const performanceScore = (analytics.performance_metrics.fast_requests / analytics.performance_metrics.total_events) * 100;
    const activeUserRate = (analytics.user_distribution.by_status.active / analytics.user_distribution.total_users) * 100;
    const completionRate = (analytics.user_distribution.by_status.completed / analytics.user_distribution.total_users) * 100;
    
    return {
      satisfaction_rate: Math.round(satisfactionRate),
      performance_score: Math.round(performanceScore),
      active_user_rate: Math.round(activeUserRate),
      completion_rate: Math.round(completionRate),
      total_users: analytics.user_distribution.total_users,
      total_feedback: analytics.satisfaction_scores.total_responses,
      error_rate: analytics.performance_metrics.error_rate,
      average_response_time: analytics.performance_metrics.average
    };
  }
}

/**
 * Express.js Route Handlers
 * These can be used with Express.js or similar frameworks
 */
export const betaRoutes = {
  
  // GET /api/beta/users
  async getUsers(req: any, res: any) {
    try {
      const { phase, status } = req.query;
      const users = await BetaUsersAPI.getUsers(phase, status);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // POST /api/beta/users
  async createUser(req: any, res: any) {
    try {
      const user = await BetaUsersAPI.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // GET /api/beta/feedback
  async getFeedback(req: any, res: any) {
    try {
      const { range, feature } = req.query;
      const feedback = await BetaFeedbackAPI.getFeedback(range, feature);
      res.json(feedback);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // POST /api/beta/feedback
  async submitFeedback(req: any, res: any) {
    try {
      const feedback = await BetaFeedbackAPI.submitFeedback(req.body);
      res.status(201).json(feedback);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // GET /api/beta/metrics
  async getMetrics(req: any, res: any) {
    try {
      const { range } = req.query;
      const metrics = await BetaMetricsAPI.getPerformanceMetrics(range);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // POST /api/beta/metrics
  async trackEvent(req: any, res: any) {
    try {
      await BetaMetricsAPI.trackEvent(req.body);
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // GET /api/beta/analytics
  async getAnalytics(req: any, res: any) {
    try {
      const analytics = await BetaAnalyticsAPI.getAnalytics();
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // GET /api/beta/kpis
  async getKPIs(req: any, res: any) {
    try {
      const kpis = await BetaAnalyticsAPI.getKPIs();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
