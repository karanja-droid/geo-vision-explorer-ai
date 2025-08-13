#!/usr/bin/env tsx

/**
 * GeoVision AI Miner - Beta Testing Setup Script
 * 
 * This script sets up the complete beta testing infrastructure including:
 * - Beta user management system
 * - Feedback collection system
 * - Performance monitoring
 * - Bug tracking integration
 * - Analytics setup
 */

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

// Types for beta testing
interface BetaUser {
  id: string;
  email: string;
  full_name: string;
  role: 'geologist' | 'geophysicist' | 'drilling_manager' | 'qa_specialist' | 'environmental_officer' | 'executive' | 'administrator';
  company: string;
  experience_level: 'junior' | 'senior' | 'expert';
  signup_date: Date;
  beta_phase: 'closed' | 'extended' | 'open';
  status: 'invited' | 'active' | 'completed' | 'churned';
  feedback_score?: number;
  feature_usage: Record<string, number>;
}

interface BetaFeedback {
  id: string;
  user_id: string;
  feature_name: string;
  satisfaction_score: number; // 1-5
  usage_frequency: 'daily' | 'weekly' | 'monthly' | 'rarely';
  feedback_text: string;
  bug_report?: string;
  improvement_suggestion?: string;
  timestamp: Date;
}

interface BetaMetrics {
  id: string;
  user_id: string;
  session_id: string;
  feature_name: string;
  action_type: 'view' | 'click' | 'form_submit' | 'api_call' | 'error';
  response_time_ms?: number;
  error_message?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class BetaTestingSetup {
  
  /**
   * Create beta testing database tables
   */
  async createBetaTables() {
    console.log('🗄️ Creating beta testing database tables...');
    
    // Beta users table
    const { error: betaUsersError } = await supabase.rpc('create_beta_users_table');
    if (betaUsersError) {
      console.error('Error creating beta_users table:', betaUsersError);
    }
    
    // Beta feedback table
    const { error: betaFeedbackError } = await supabase.rpc('create_beta_feedback_table');
    if (betaFeedbackError) {
      console.error('Error creating beta_feedback table:', betaFeedbackError);
    }
    
    // Beta metrics table
    const { error: betaMetricsError } = await supabase.rpc('create_beta_metrics_table');
    if (betaMetricsError) {
      console.error('Error creating beta_metrics table:', betaMetricsError);
    }
    
    console.log('✅ Beta testing tables created successfully');
  }
  
  /**
   * Generate beta test users for different phases
   */
  async generateBetaUsers() {
    console.log('👥 Generating beta test users...');
    
    const betaUsers: Partial<BetaUser>[] = [];
    
    // Phase 1: Closed Beta (25 internal experts)
    for (let i = 0; i < 25; i++) {
      betaUsers.push({
        email: faker.internet.email(),
        full_name: faker.person.fullName(),
        role: faker.helpers.arrayElement(['geologist', 'geophysicist', 'drilling_manager', 'qa_specialist', 'environmental_officer', 'executive']),
        company: faker.helpers.arrayElement([
          'Barrick Gold Corporation',
          'Newmont Corporation', 
          'Freeport-McMoRan',
          'BHP Group',
          'Rio Tinto',
          'Anglo American',
          'Glencore',
          'Vale S.A.'
        ]),
        experience_level: faker.helpers.arrayElement(['senior', 'expert']),
        signup_date: faker.date.recent({ days: 7 }),
        beta_phase: 'closed',
        status: 'invited',
        feature_usage: {}
      });
    }
    
    // Phase 2: Extended Beta (50 external professionals)
    for (let i = 0; i < 50; i++) {
      betaUsers.push({
        email: faker.internet.email(),
        full_name: faker.person.fullName(),
        role: faker.helpers.arrayElement(['geologist', 'geophysicist', 'drilling_manager', 'qa_specialist', 'environmental_officer', 'executive']),
        company: faker.company.name() + ' Mining',
        experience_level: faker.helpers.arrayElement(['junior', 'senior', 'expert']),
        signup_date: faker.date.recent({ days: 14 }),
        beta_phase: 'extended',
        status: 'invited',
        feature_usage: {}
      });
    }
    
    // Phase 3: Open Beta (100 public users)
    for (let i = 0; i < 100; i++) {
      betaUsers.push({
        email: faker.internet.email(),
        full_name: faker.person.fullName(),
        role: faker.helpers.arrayElement(['geologist', 'geophysicist', 'drilling_manager', 'qa_specialist', 'environmental_officer', 'executive']),
        company: faker.company.name(),
        experience_level: faker.helpers.arrayElement(['junior', 'senior', 'expert']),
        signup_date: faker.date.recent({ days: 21 }),
        beta_phase: 'open',
        status: 'invited',
        feature_usage: {}
      });
    }
    
    // Insert beta users
    const { error } = await supabase
      .from('beta_users')
      .insert(betaUsers);
    
    if (error) {
      console.error('Error inserting beta users:', error);
      return;
    }
    
    console.log(`✅ Generated ${betaUsers.length} beta test users`);
  }
  
  /**
   * Set up feedback collection system
   */
  async setupFeedbackSystem() {
    console.log('📝 Setting up feedback collection system...');
    
    // Create feedback collection triggers
    const feedbackTriggers = [
      'project_created',
      'site_analyzed', 
      'ai_prediction_completed',
      'map_interaction',
      'report_generated',
      'collaboration_session',
      'mobile_usage',
      'data_export'
    ];
    
    // Sample feedback data for testing
    const sampleFeedback: Partial<BetaFeedback>[] = [];
    
    for (let i = 0; i < 200; i++) {
      sampleFeedback.push({
        user_id: faker.string.uuid(),
        feature_name: faker.helpers.arrayElement(feedbackTriggers),
        satisfaction_score: faker.number.int({ min: 3, max: 5 }), // Bias toward positive
        usage_frequency: faker.helpers.arrayElement(['daily', 'weekly', 'monthly']),
        feedback_text: faker.lorem.sentences(2),
        improvement_suggestion: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
        timestamp: faker.date.recent({ days: 21 })
      });
    }
    
    const { error } = await supabase
      .from('beta_feedback')
      .insert(sampleFeedback);
    
    if (error) {
      console.error('Error inserting sample feedback:', error);
      return;
    }
    
    console.log('✅ Feedback collection system setup complete');
  }
  
  /**
   * Set up performance monitoring and metrics
   */
  async setupPerformanceMonitoring() {
    console.log('📊 Setting up performance monitoring...');
    
    // Generate sample performance metrics
    const performanceMetrics: Partial<BetaMetrics>[] = [];
    
    const features = [
      'project_dashboard',
      'ai_analysis',
      'interactive_map',
      'data_table',
      'site_form',
      'mineral_deposit_form',
      'collaboration',
      'mobile_app'
    ];
    
    const actions = ['view', 'click', 'form_submit', 'api_call'];
    
    for (let i = 0; i < 5000; i++) {
      const feature = faker.helpers.arrayElement(features);
      const action = faker.helpers.arrayElement(actions);
      
      performanceMetrics.push({
        user_id: faker.string.uuid(),
        session_id: faker.string.uuid(),
        feature_name: feature,
        action_type: action as any,
        response_time_ms: faker.number.int({ min: 200, max: 3000 }),
        timestamp: faker.date.recent({ days: 21 }),
        metadata: {
          user_agent: faker.internet.userAgent(),
          ip_address: faker.internet.ip(),
          screen_resolution: faker.helpers.arrayElement(['1920x1080', '1366x768', '1440x900', '375x667']),
          connection_type: faker.helpers.arrayElement(['4g', 'wifi', '3g'])
        }
      });
    }
    
    // Add some error metrics (small percentage)
    for (let i = 0; i < 50; i++) {
      performanceMetrics.push({
        user_id: faker.string.uuid(),
        session_id: faker.string.uuid(),
        feature_name: faker.helpers.arrayElement(features),
        action_type: 'error',
        error_message: faker.helpers.arrayElement([
          'Network timeout',
          'API rate limit exceeded',
          'Invalid data format',
          'Authentication failed',
          'Server error 500'
        ]),
        timestamp: faker.date.recent({ days: 21 }),
        metadata: {
          error_stack: faker.lorem.paragraph(),
          browser: faker.internet.userAgent()
        }
      });
    }
    
    const { error } = await supabase
      .from('beta_metrics')
      .insert(performanceMetrics);
    
    if (error) {
      console.error('Error inserting performance metrics:', error);
      return;
    }
    
    console.log('✅ Performance monitoring setup complete');
  }
  
  /**
   * Generate beta testing analytics dashboard
   */
  async generateAnalyticsDashboard() {
    console.log('📈 Generating beta testing analytics...');
    
    // User engagement analytics
    const { data: userStats } = await supabase
      .from('beta_users')
      .select('role, beta_phase, status, experience_level')
      .order('signup_date', { ascending: false });
    
    // Feedback analytics
    const { data: feedbackStats } = await supabase
      .from('beta_feedback')
      .select('feature_name, satisfaction_score, usage_frequency')
      .order('timestamp', { ascending: false });
    
    // Performance analytics
    const { data: performanceStats } = await supabase
      .from('beta_metrics')
      .select('feature_name, action_type, response_time_ms')
      .not('response_time_ms', 'is', null)
      .order('timestamp', { ascending: false });
    
    // Calculate key metrics
    const analytics = {
      user_distribution: this.calculateUserDistribution(userStats || []),
      satisfaction_scores: this.calculateSatisfactionScores(feedbackStats || []),
      performance_metrics: this.calculatePerformanceMetrics(performanceStats || []),
      feature_adoption: this.calculateFeatureAdoption(feedbackStats || []),
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Beta Testing Analytics:');
    console.log(JSON.stringify(analytics, null, 2));
    
    return analytics;
  }
  
  private calculateUserDistribution(users: any[]) {
    const distribution = {
      by_role: {} as Record<string, number>,
      by_phase: {} as Record<string, number>,
      by_experience: {} as Record<string, number>,
      total_users: users.length
    };
    
    users.forEach(user => {
      distribution.by_role[user.role] = (distribution.by_role[user.role] || 0) + 1;
      distribution.by_phase[user.beta_phase] = (distribution.by_phase[user.beta_phase] || 0) + 1;
      distribution.by_experience[user.experience_level] = (distribution.by_experience[user.experience_level] || 0) + 1;
    });
    
    return distribution;
  }
  
  private calculateSatisfactionScores(feedback: any[]) {
    const scores = feedback.map(f => f.satisfaction_score).filter(s => s);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    return {
      average_score: Math.round(average * 100) / 100,
      total_responses: scores.length,
      score_distribution: {
        5: scores.filter(s => s === 5).length,
        4: scores.filter(s => s === 4).length,
        3: scores.filter(s => s === 3).length,
        2: scores.filter(s => s === 2).length,
        1: scores.filter(s => s === 1).length
      }
    };
  }
  
  private calculatePerformanceMetrics(metrics: any[]) {
    const responseTimes = metrics.map(m => m.response_time_ms).filter(rt => rt);
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const p95 = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
    
    return {
      average_response_time: Math.round(average),
      p95_response_time: p95,
      total_requests: responseTimes.length,
      fast_requests: responseTimes.filter(rt => rt < 2000).length,
      slow_requests: responseTimes.filter(rt => rt >= 2000).length
    };
  }
  
  private calculateFeatureAdoption(feedback: any[]) {
    const adoption = {} as Record<string, number>;
    
    feedback.forEach(f => {
      adoption[f.feature_name] = (adoption[f.feature_name] || 0) + 1;
    });
    
    return Object.entries(adoption)
      .sort(([,a], [,b]) => b - a)
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
  }
  
  /**
   * Run complete beta testing setup
   */
  async runSetup() {
    console.log('🚀 Starting GeoVision AI Miner Beta Testing Setup...\n');
    
    try {
      await this.createBetaTables();
      await this.generateBetaUsers();
      await this.setupFeedbackSystem();
      await this.setupPerformanceMonitoring();
      await this.generateAnalyticsDashboard();
      
      console.log('\n🎉 Beta testing setup completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Deploy beta environment: kubectl apply -f k8s/beta-environment.yaml');
      console.log('2. Start user invitations: npm run beta:invite-users');
      console.log('3. Monitor beta metrics: npm run beta:analytics');
      console.log('4. Collect feedback: Check beta dashboard at /beta/dashboard');
      
    } catch (error) {
      console.error('❌ Beta testing setup failed:', error);
      process.exit(1);
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new BetaTestingSetup();
  setup.runSetup();
}

export { BetaTestingSetup };