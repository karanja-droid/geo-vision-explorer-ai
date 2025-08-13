import { monitoring } from './monitoring';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: Record<string, any>;
}

export interface PerformanceBudget {
  metric: string;
  budget: number;
  unit: string;
  severity: 'warning' | 'error';
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private budgets: PerformanceBudget[] = [];
  private observers: PerformanceObserver[] = [];

  private constructor() {
    this.setupDefaultBudgets();
    this.initializeObservers();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupDefaultBudgets(): void {
    this.budgets = [
      { metric: 'LCP', budget: 2500, unit: 'ms', severity: 'warning' },
      { metric: 'FID', budget: 100, unit: 'ms', severity: 'warning' },
      { metric: 'CLS', budget: 0.1, unit: 'score', severity: 'warning' },
      { metric: 'TTFB', budget: 800, unit: 'ms', severity: 'warning' },
      { metric: 'FCP', budget: 1800, unit: 'ms', severity: 'warning' },
      { metric: 'api_response', budget: 1000, unit: 'ms', severity: 'warning' },
      { metric: 'map_render', budget: 2000, unit: 'ms', severity: 'warning' },
      { metric: 'chart_render', budget: 500, unit: 'ms', severity: 'warning' },
    ];
  }

  private initializeObservers(): void {
    // Navigation timing observer
    if ('PerformanceObserver' in window) {
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('page_load', navEntry.loadEventEnd - navEntry.fetchStart, 'ms');
            this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'ms');
            this.recordMetric('first_byte', navEntry.responseStart - navEntry.fetchStart, 'ms');
          }
        });
      });

      try {
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (error) {
        console.warn('Navigation timing observer not supported:', error);
      }
    }

    // Resource timing observer
    if ('PerformanceObserver' in window) {
      const resourceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            
            // Track slow resources
            if (resourceEntry.duration > 1000) {
              this.recordMetric(
                'slow_resource',
                resourceEntry.duration,
                'ms',
                {
                  name: resourceEntry.name,
                  type: resourceEntry.initiatorType,
                  size: resourceEntry.transferSize,
                }
              );
            }

            // Track specific resource types
            if (resourceEntry.name.includes('api/')) {
              this.recordMetric('api_response', resourceEntry.duration, 'ms', {
                endpoint: resourceEntry.name,
              });
            }
          }
        });
      });

      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource timing observer not supported:', error);
      }
    }

    // Long task observer
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'longtask') {
            this.recordMetric('long_task', entry.duration, 'ms', {
              startTime: entry.startTime,
            });
            
            // Alert for very long tasks
            if (entry.duration > 100) {
              monitoring.trackEvent('long_task_detected', {
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          }
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }
  }

  // Record a performance metric
  recordMetric(
    name: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      context,
    };

    this.metrics.push(metric);
    
    // Check against budgets
    this.checkBudget(metric);
    
    // Keep only recent metrics (last 100)
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Track in monitoring service
    monitoring.trackBusinessMetric(name, value, unit, context);
  }

  private checkBudget(metric: PerformanceMetric): void {
    const budget = this.budgets.find(b => b.metric === metric.name);
    if (budget && metric.value > budget.budget) {
      const message = `Performance budget exceeded: ${metric.name} (${metric.value}${metric.unit} > ${budget.budget}${budget.unit})`;
      
      if (budget.severity === 'error') {
        console.error(message);
        monitoring.trackEvent('performance_budget_exceeded', {
          metric: metric.name,
          value: metric.value,
          budget: budget.budget,
          severity: budget.severity,
        });
      } else {
        console.warn(message);
        monitoring.trackEvent('performance_budget_warning', {
          metric: metric.name,
          value: metric.value,
          budget: budget.budget,
          severity: budget.severity,
        });
      }
    }
  }

  // Measure function execution time
  async measureFunction<T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', {
        ...context,
        success: true,
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', {
        ...context,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  // Measure React component render time
  measureComponentRender(componentName: string, renderTime: number): void {
    this.recordMetric('component_render', renderTime, 'ms', {
      component: componentName,
    });
  }

  // Measure API call performance
  async measureApiCall<T>(
    endpoint: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    return this.measureFunction(
      'api_call',
      apiCall,
      { endpoint }
    );
  }

  // Measure map rendering performance
  measureMapRender(duration: number, context?: Record<string, any>): void {
    this.recordMetric('map_render', duration, 'ms', context);
  }

  // Measure chart rendering performance
  measureChartRender(chartType: string, duration: number): void {
    this.recordMetric('chart_render', duration, 'ms', {
      chartType,
    });
  }

  // Get performance summary
  getSummary(timeWindow: number = 300000): { // 5 minutes default
    const cutoff = Date.now() - timeWindow;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    const summary: Record<string, {
      count: number;
      avg: number;
      min: number;
      max: number;
      p95: number;
    }> = {};

    // Group metrics by name
    const grouped = recentMetrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    // Calculate statistics for each metric
    Object.entries(grouped).forEach(([name, values]) => {
      const sorted = values.sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      
      summary[name] = {
        count: values.length,
        avg: sum / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      };
    });

    return summary;
  }

  // Get current performance score
  getPerformanceScore(): number {
    const summary = this.getSummary();
    let score = 100;
    
    // Deduct points for budget violations
    this.budgets.forEach(budget => {
      const metric = summary[budget.metric];
      if (metric && metric.avg > budget.budget) {
        const violation = (metric.avg - budget.budget) / budget.budget;
        const penalty = Math.min(violation * 20, 30); // Max 30 points per violation
        score -= penalty;
      }
    });
    
    return Math.max(0, Math.round(score));
  }

  // Export metrics for analysis
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['name', 'value', 'unit', 'timestamp', 'context'];
      const rows = this.metrics.map(m => [
        m.name,
        m.value.toString(),
        m.unit,
        new Date(m.timestamp).toISOString(),
        JSON.stringify(m.context || {}),
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(this.metrics, null, 2);
  }

  // Clear metrics
  clearMetrics(): void {
    this.metrics = [];
  }

  // Cleanup observers
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  // Add custom budget
  addBudget(budget: PerformanceBudget): void {
    const existingIndex = this.budgets.findIndex(b => b.metric === budget.metric);
    if (existingIndex >= 0) {
      this.budgets[existingIndex] = budget;
    } else {
      this.budgets.push(budget);
    }
  }

  // Remove budget
  removeBudget(metric: string): void {
    this.budgets = this.budgets.filter(b => b.metric !== metric);
  }

  // Get all budgets
  getBudgets(): PerformanceBudget[] {
    return [...this.budgets];
  }
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();
  
  const measureRender = (componentName: string, renderTime: number) => {
    monitor.measureComponentRender(componentName, renderTime);
  };
  
  const measureAsync = async <T>(
    name: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> => {
    return monitor.measureFunction(name, fn, context);
  };
  
  const recordMetric = (name: string, value: number, unit: string, context?: Record<string, any>) => {
    monitor.recordMetric(name, value, unit, context);
  };
  
  return {
    measureRender,
    measureAsync,
    recordMetric,
    getSummary: () => monitor.getSummary(),
    getScore: () => monitor.getPerformanceScore(),
  };
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

export default PerformanceMonitor;