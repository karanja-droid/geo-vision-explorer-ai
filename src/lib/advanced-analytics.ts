import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';

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

export interface CustomMetric {
  id: string;
  name: string;
  description: string;
  formula: string;
  dataSource: string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  filters?: Record<string, any>;
  createdBy: string;
  createdAt: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  userId: string;
  isShared: boolean;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'map' | 'text';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: WidgetConfig;
  dataSource: string;
  refreshInterval?: number;
}

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge';
  metrics: string[];
  dimensions: string[];
  filters?: Record<string, any>;
  aggregation?: string;
  timeRange?: string;
  colorScheme?: string;
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'date_range' | 'select' | 'multi_select' | 'text' | 'number_range';
  field: string;
  value: any;
  options?: Array<{ label: string; value: any }>;
}

export interface Report {
  id: string;
  name: string;
  description: string;
  userId: string;
  template: ReportTemplate;
  config: ReportConfig;
  schedule?: CronSchedule;
  lastRun?: Date;
  nextRun?: Date;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'html';
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: ReportSection[];
  defaultConfig: ReportConfig;
}

export interface ReportSection {
  id: string;
  name: string;
  type: 'summary' | 'chart' | 'table' | 'text' | 'image';
  config: any;
  order: number;
}

export interface ReportConfig {
  title: string;
  subtitle?: string;
  timeRange: string;
  filters: Record<string, any>;
  sections: string[];
  branding?: {
    logo?: string;
    colors?: string[];
    fonts?: string[];
  };
}

export interface CronSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  timezone: string;
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters: QueryFilter[];
  timeRange: TimeRange;
  aggregation?: string;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'starts_with';
  value: any;
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface AnalyticsResult {
  data: any[];
  metadata: {
    totalRows: number;
    executionTime: number;
    cacheHit: boolean;
    query: string;
  };
}

export class AdvancedAnalytics {
  /**
   * Get KPI metrics for dashboard
   */
  async getKPIs(userId: string, timeRange: TimeRange, category?: string): Promise<KPIMetric[]> {
    const cacheKey = `kpis_${userId}_${timeRange.start.getTime()}_${timeRange.end.getTime()}_${category || 'all'}`;
    
    // Check cache first
    const cached = await cacheManager.get<KPIMetric[]>(cacheKey);
    if (cached) return cached;

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

      // Team KPIs
      if (!category || category === 'team') {
        const teamKPIs = await this.getTeamKPIs(userId, timeRange);
        kpis.push(...teamKPIs);
      }

      // AI Performance KPIs
      if (!category || category === 'ai_performance') {
        const aiKPIs = await this.getAIPerformanceKPIs(userId, timeRange);
        kpis.push(...aiKPIs);
      }

      // Cache results
      await cacheManager.set(cacheKey, kpis, 300); // 5 minutes

      return kpis;
    } catch (error) {
      console.error('Failed to get KPIs:', error);
      throw error;
    }
  }

  /**
   * Execute custom analytics query
   */
  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const startTime = performance.now();
    const cacheKey = `query_${JSON.stringify(query)}`;
    
    // Check cache
    const cached = await cacheManager.get<AnalyticsResult>(cacheKey);
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          cacheHit: true
        }
      };
    }

    try {
      // Build SQL query
      const sqlQuery = this.buildSQLQuery(query);
      
      // Execute query
      const { data, error } = await supabase.rpc('execute_analytics_query', {
        query_sql: sqlQuery
      });

      if (error) {
        throw new Error(`Query execution failed: ${error.message}`);
      }

      const executionTime = performance.now() - startTime;
      
      const result: AnalyticsResult = {
        data: data || [],
        metadata: {
          totalRows: data?.length || 0,
          executionTime,
          cacheHit: false,
          query: sqlQuery
        }
      };

      // Cache result
      await cacheManager.set(cacheKey, result, 600); // 10 minutes

      return result;
    } catch (error) {
      console.error('Failed to execute query:', error);
      throw error;
    }
  }

  /**
   * Create custom dashboard
   */
  async createDashboard(userId: string, config: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<Dashboard> {
    try {
      const dashboard: Omit<Dashboard, 'id'> = {
        ...config,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { data, error } = await supabase
        .from('dashboards')
        .insert(dashboard)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create dashboard: ${error.message}`);
      }

      return this.mapDashboardFromDB(data);
    } catch (error) {
      console.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  /**
   * Get user dashboards
   */
  async getUserDashboards(userId: string): Promise<Dashboard[]> {
    const cacheKey = `user_dashboards_${userId}`;
    const cached = await cacheManager.get<Dashboard[]>(cacheKey);
    
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('dashboards')
        .select('*')
        .or(`user_id.eq.${userId},is_shared.eq.true`)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch dashboards: ${error.message}`);
      }

      const dashboards = data.map(this.mapDashboardFromDB);
      await cacheManager.set(cacheKey, dashboards, 300);

      return dashboards;
    } catch (error) {
      console.error('Failed to get user dashboards:', error);
      throw error;
    }
  }

  /**
   * Export dashboard data
   */
  async exportDashboard(dashboardId: string, format: 'pdf' | 'excel' | 'csv'): Promise<Buffer> {
    try {
      // Get dashboard configuration
      const { data: dashboard, error } = await supabase
        .from('dashboards')
        .select('*')
        .eq('id', dashboardId)
        .single();

      if (error) {
        throw new Error(`Dashboard not found: ${error.message}`);
      }

      // Generate export based on format
      switch (format) {
        case 'pdf':
          return this.generatePDFExport(dashboard);
        case 'excel':
          return this.generateExcelExport(dashboard);
        case 'csv':
          return this.generateCSVExport(dashboard);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export dashboard:', error);
      throw error;
    }
  }

  // Private methods for KPI calculations
  private async getExplorationKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Active Projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const activeProjects = projects?.filter(p => p.status === 'active').length || 0;
    const totalProjects = projects?.length || 0;

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
      .from('sites')
      .select('id, created_at')
      .eq('user_id', userId)
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

    // Mineral Discoveries
    const { data: deposits } = await supabase
      .from('mineral_deposits')
      .select('id, confidence_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const highConfidenceDeposits = deposits?.filter(d => d.confidence_score >= 0.8).length || 0;

    kpis.push({
      id: 'mineral_discoveries',
      name: 'High-Confidence Discoveries',
      value: highConfidenceDeposits,
      unit: 'deposits',
      trend: 'up',
      change: 3,
      changePercent: 25.0,
      target: 20,
      category: 'exploration',
      description: 'Mineral deposits with >80% confidence score',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getFinancialKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Estimated Value
    const { data: deposits } = await supabase
      .from('mineral_deposits')
      .select('estimated_value, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const totalValue = deposits?.reduce((sum, d) => sum + (d.estimated_value || 0), 0) || 0;

    kpis.push({
      id: 'estimated_value',
      name: 'Total Estimated Value',
      value: totalValue,
      unit: 'USD',
      trend: 'up',
      change: 150000,
      changePercent: 8.5,
      category: 'financial',
      description: 'Total estimated value of discovered mineral deposits',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    // Cost per Discovery
    const explorationCosts = 50000; // This would come from actual cost tracking
    const discoveries = deposits?.length || 0;
    const costPerDiscovery = discoveries > 0 ? explorationCosts / discoveries : 0;

    kpis.push({
      id: 'cost_per_discovery',
      name: 'Cost per Discovery',
      value: costPerDiscovery,
      unit: 'USD',
      trend: 'down',
      change: -2500,
      changePercent: -5.2,
      category: 'financial',
      description: 'Average cost to discover each mineral deposit',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getOperationalKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Analysis Completion Rate
    const { data: analyses } = await supabase
      .from('ai_predictions')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const completedAnalyses = analyses?.filter(a => a.status === 'completed').length || 0;
    const totalAnalyses = analyses?.length || 0;
    const completionRate = totalAnalyses > 0 ? (completedAnalyses / totalAnalyses) * 100 : 0;

    kpis.push({
      id: 'analysis_completion_rate',
      name: 'Analysis Completion Rate',
      value: completionRate,
      unit: '%',
      trend: 'up',
      change: 2.5,
      changePercent: 2.7,
      target: 95,
      category: 'operational',
      description: 'Percentage of AI analyses completed successfully',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getTeamKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // Team Productivity (placeholder - would need actual team data)
    kpis.push({
      id: 'team_productivity',
      name: 'Team Productivity',
      value: 87.5,
      unit: '%',
      trend: 'up',
      change: 3.2,
      changePercent: 3.8,
      target: 90,
      category: 'team',
      description: 'Overall team productivity score',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private async getAIPerformanceKPIs(userId: string, timeRange: TimeRange): Promise<KPIMetric[]> {
    const kpis: KPIMetric[] = [];

    // AI Model Accuracy
    const { data: predictions } = await supabase
      .from('ai_predictions')
      .select('confidence_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    const avgAccuracy = predictions?.length > 0 
      ? predictions.reduce((sum, p) => sum + p.confidence_score, 0) / predictions.length * 100
      : 0;

    kpis.push({
      id: 'ai_model_accuracy',
      name: 'AI Model Accuracy',
      value: avgAccuracy,
      unit: '%',
      trend: 'up',
      change: 1.8,
      changePercent: 2.1,
      target: 85,
      category: 'ai_performance',
      description: 'Average confidence score of AI predictions',
      lastUpdated: new Date(),
      timeRange: 'period'
    });

    return kpis;
  }

  private buildSQLQuery(query: AnalyticsQuery): string {
    // This is a simplified SQL builder - in production you'd want a more robust solution
    let sql = 'SELECT ';
    
    // Add metrics and dimensions
    const fields = [...query.metrics, ...query.dimensions];
    sql += fields.join(', ');
    
    // Add FROM clause (this would be determined by the data source)
    sql += ' FROM analytics_view ';
    
    // Add WHERE clause for filters
    if (query.filters.length > 0) {
      sql += 'WHERE ';
      const filterClauses = query.filters.map(filter => {
        switch (filter.operator) {
          case 'eq': return `${filter.field} = '${filter.value}'`;
          case 'ne': return `${filter.field} != '${filter.value}'`;
          case 'gt': return `${filter.field} > ${filter.value}`;
          case 'gte': return `${filter.field} >= ${filter.value}`;
          case 'lt': return `${filter.field} < ${filter.value}`;
          case 'lte': return `${filter.field} <= ${filter.value}`;
          case 'in': return `${filter.field} IN (${filter.value.map((v: any) => `'${v}'`).join(', ')})`;
          case 'contains': return `${filter.field} ILIKE '%${filter.value}%'`;
          default: return `${filter.field} = '${filter.value}'`;
        }
      });
      sql += filterClauses.join(' AND ');
    }
    
    // Add time range filter
    sql += ` AND created_at >= '${query.timeRange.start.toISOString()}'`;
    sql += ` AND created_at <= '${query.timeRange.end.toISOString()}'`;
    
    // Add GROUP BY if we have dimensions
    if (query.dimensions.length > 0) {
      sql += ` GROUP BY ${query.dimensions.join(', ')}`;
    }
    
    // Add ORDER BY
    if (query.orderBy) {
      sql += ` ORDER BY ${query.orderBy} ${query.orderDirection || 'ASC'}`;
    }
    
    // Add LIMIT
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`;
    }
    
    return sql;
  }

  private async generatePDFExport(dashboard: any): Promise<Buffer> {
    // Implementation would use a PDF generation library like Puppeteer or jsPDF
    // This is a placeholder
    return Buffer.from('PDF export placeholder');
  }

  private async generateExcelExport(dashboard: any): Promise<Buffer> {
    // Implementation would use a library like ExcelJS
    // This is a placeholder
    return Buffer.from('Excel export placeholder');
  }

  private async generateCSVExport(dashboard: any): Promise<Buffer> {
    // Implementation would generate CSV data
    // This is a placeholder
    return Buffer.from('CSV export placeholder');
  }

  private mapDashboardFromDB(data: any): Dashboard {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      userId: data.user_id,
      isShared: data.is_shared,
      layout: data.layout,
      widgets: data.widgets,
      filters: data.filters,
      refreshInterval: data.refresh_interval,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

// Report Builder class
export class ReportBuilder {
  private analytics = new AdvancedAnalytics();

  async createReport(userId: string, config: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    try {
      const report: Omit<Report, 'id'> = {
        ...config,
        userId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const { data, error } = await supabase
        .from('reports')
        .insert(report)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create report: ${error.message}`);
      }

      return this.mapReportFromDB(data);
    } catch (error) {
      console.error('Failed to create report:', error);
      throw error;
    }
  }

  async scheduleReport(reportId: string, schedule: CronSchedule): Promise<void> {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          schedule,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) {
        throw new Error(`Failed to schedule report: ${error.message}`);
      }

      // Schedule the report execution (this would integrate with a job queue)
      await this.scheduleReportExecution(reportId, schedule);
    } catch (error) {
      console.error('Failed to schedule report:', error);
      throw error;
    }
  }

  async shareReport(reportId: string, recipients: string[]): Promise<void> {
    try {
      // Update report with recipients
      const { error } = await supabase
        .from('reports')
        .update({
          recipients,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (error) {
        throw new Error(`Failed to share report: ${error.message}`);
      }

      // Send sharing notifications
      await this.sendSharingNotifications(reportId, recipients);
    } catch (error) {
      console.error('Failed to share report:', error);
      throw error;
    }
  }

  async getReportTemplates(): Promise<ReportTemplate[]> {
    const cacheKey = 'report_templates';
    const cached = await cacheManager.get<ReportTemplate[]>(cacheKey);
    
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      const templates = data.map(this.mapTemplateFromDB);
      await cacheManager.set(cacheKey, templates, 3600); // 1 hour

      return templates;
    } catch (error) {
      console.error('Failed to get report templates:', error);
      throw error;
    }
  }

  private async scheduleReportExecution(reportId: string, schedule: CronSchedule): Promise<void> {
    // This would integrate with your job queue system
    console.log(`Scheduling report ${reportId} with schedule:`, schedule);
  }

  private async sendSharingNotifications(reportId: string, recipients: string[]): Promise<void> {
    // This would send email notifications to recipients
    console.log(`Sending sharing notifications for report ${reportId} to:`, recipients);
  }

  private mapReportFromDB(data: any): Report {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      userId: data.user_id,
      template: data.template,
      config: data.config,
      schedule: data.schedule,
      lastRun: data.last_run ? new Date(data.last_run) : undefined,
      nextRun: data.next_run ? new Date(data.next_run) : undefined,
      recipients: data.recipients,
      format: data.format,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapTemplateFromDB(data: any): ReportTemplate {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      sections: data.sections,
      defaultConfig: data.default_config
    };
  }
}

// Export instances
export const advancedAnalytics = new AdvancedAnalytics();
export const reportBuilder = new ReportBuilder();

// React hooks
export function useAnalytics() {
  const [kpis, setKpis] = React.useState<KPIMetric[]>([]);
  const [dashboards, setDashboards] = React.useState<Dashboard[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refreshKPIs = async (userId: string, timeRange: TimeRange, category?: string) => {
    try {
      const data = await advancedAnalytics.getKPIs(userId, timeRange, category);
      setKpis(data);
    } catch (error) {
      console.error('Failed to refresh KPIs:', error);
    }
  };

  const loadDashboards = async (userId: string) => {
    try {
      const data = await advancedAnalytics.getUserDashboards(userId);
      setDashboards(data);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async (query: AnalyticsQuery) => {
    return advancedAnalytics.executeQuery(query);
  };

  return {
    kpis,
    dashboards,
    loading,
    refreshKPIs,
    loadDashboards,
    executeQuery,
    analytics: advancedAnalytics,
    reportBuilder
  };
}