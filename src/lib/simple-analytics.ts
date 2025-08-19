import { supabase } from '@/integrations/supabase/client';

export interface KPIMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
  target?: number;
  category: 'exploration' | 'financial' | 'operational' | 'team' | 'ai_performance';
  description: string;
  lastUpdated: Date;
  timeRange: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export class SimpleAnalytics {
  /**
   * Get basic KPI metrics for dashboard
   */
  async getKPIs(userId: string, timeRange: TimeRange, category?: string): Promise<KPIMetric[]> {
    try {
      const kpis: KPIMetric[] = [];

      // Exploration KPIs
      if (!category || category === 'exploration') {
        const explorationKPIs = await this.getExplorationKPIs(userId, timeRange);
        kpis.push(...explorationKPIs);
      }

      // Financial KPIs
      if (!category || category === 'financial') {
        const financialKPIs = await this.getFinancialKPIs(userId, timeRange);
        kpis.push(...financialKPIs);
      }

      // Operational KPIs
      if (!category || category === 'operational') {
        const operationalKPIs = await this.getOperationalKPIs(userId, timeRange);
        kpis.push(...operationalKPIs);
      }

      return kpis;
    } catch (error) {
      console.error('Failed to get KPIs:', error);
      throw error;
    }
  }

  private async getExplorationKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Active Projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, status, created_at')
      .eq('owner_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const activeProjects = projects?.filter(p => p.status === 'active').length || 0;

    kpis.push({
      id: 'active_projects',
      name: 'Active Projects',
      value: activeProjects,
      unit: 'projects',
      trend: 'stable',
      change: 0,
      changePercent: 0,
      category: 'exploration',
      description: 'Number of currently active exploration projects',
      lastUpdated: new Date(),
      timeRange: 'current'
    });

    // Sites Analyzed
    const { data: sites } = await supabase
      .from('exploration_sites')
      .select('id, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    kpis.push({
      id: 'sites_analyzed',
      name: 'Sites Analyzed',
      value: sites?.length || 0,
      unit: 'sites',
      trend: 'up',
      change: 5,
      changePercent: 12.5,
      category: 'exploration',
      description: 'Total number of geological sites analyzed',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getFinancialKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Projects Budget
    const { data: projects } = await supabase
      .from('projects')
      .select('budget')
      .eq('owner_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const totalBudget = projects?.reduce((sum, p) => sum + (p.budget || 0), 0) || 0;

    kpis.push({
      id: 'total_budget',
      name: 'Total Budget',
      value: totalBudget,
      unit: 'USD',
      trend: 'up',
      change: 25000,
      changePercent: 5.2,
      category: 'financial',
      description: 'Total budget allocated to active projects',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getOperationalKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // AI Model Runs
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, created_at')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    kpis.push({
      id: 'ai_runs',
      name: 'AI Model Runs',
      value: predictions?.length || 0,
      unit: 'runs',
      trend: 'up',
      change: 12,
      changePercent: 15.8,
      category: 'operational',
      description: 'Total AI prediction models executed',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }
}

export const simpleAnalytics = new SimpleAnalytics();