import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export interface MonitoringConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  enablePerformanceMonitoring?: boolean;
  enableUserFeedback?: boolean;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private isInitialized = false;
  private config: MonitoringConfig;

  private constructor(config: MonitoringConfig) {
    this.config = config;
  }

  static getInstance(config?: MonitoringConfig): MonitoringService {
    if (!MonitoringService.instance && config) {
      MonitoringService.instance = new MonitoringService(config);
    }
    return MonitoringService.instance;
  }

  initialize(): void {
    if (this.isInitialized) {
      console.warn('Monitoring service already initialized');
      return;
    }

    Sentry.init({
      dsn: this.config.dsn,
      environment: this.config.environment,
      release: this.config.release,
      sampleRate: this.config.sampleRate || 1.0,
      tracesSampleRate: this.config.tracesSampleRate || 0.1,
      
      integrations: [
        new BrowserTracing({
          // Set up automatic route change tracking for React Router
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes
          ),
        }),
        new Sentry.Replay({
          // Capture 10% of all sessions,
          // plus 100% of sessions with an error
          sessionSampleRate: 0.1,
          errorSampleRate: 1.0,
        }),
      ],

      beforeSend: this.config.beforeSend || this.defaultBeforeSend,

      // Performance monitoring
      ...(this.config.enablePerformanceMonitoring && {
        beforeSendTransaction: (event) => {
          // Filter out noisy transactions
          if (event.transaction?.includes('heartbeat')) {
            return null;
          }
          return event;
        },
      }),

      // User feedback
      ...(this.config.enableUserFeedback && {
        beforeSend: (event, hint) => {
          // Show user feedback dialog for errors
          if (event.exception) {
            const eventId = Sentry.captureException(hint.originalException);
            Sentry.showReportDialog({ eventId });
          }
          return event;
        },
      }),
    });

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
    
    // Set up performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    this.isInitialized = true;
    console.log('🔍 Monitoring service initialized');
  }

  private defaultBeforeSend = (event: Sentry.Event): Sentry.Event | null => {
    // Filter out development-only errors
    if (this.config.environment === 'development') {
      const error = event.exception?.values?.[0];
      if (error?.value?.includes('ResizeObserver loop limit exceeded')) {
        return null;
      }
      if (error?.value?.includes('Non-Error promise rejection captured')) {
        return null;
      }
    }

    // Filter out network errors that are expected
    if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
      return null;
    }

    // Add additional context
    event.tags = {
      ...event.tags,
      component: 'frontend',
      platform: 'web',
    };

    return event;
  };

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      Sentry.captureException(event.reason, {
        tags: { type: 'unhandled_promise_rejection' },
        extra: { promise: event.promise },
      });
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
      Sentry.captureException(event.error, {
        tags: { type: 'global_error' },
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  private setupPerformanceMonitoring(): void {
    // Monitor Core Web Vitals
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `CLS: ${metric.value}`,
          level: 'info',
          data: metric,
        });
      });

      getFID((metric) => {
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `FID: ${metric.value}ms`,
          level: 'info',
          data: metric,
        });
      });

      getFCP((metric) => {
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `FCP: ${metric.value}ms`,
          level: 'info',
          data: metric,
        });
      });

      getLCP((metric) => {
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `LCP: ${metric.value}ms`,
          level: 'info',
          data: metric,
        });
      });

      getTTFB((metric) => {
        Sentry.addBreadcrumb({
          category: 'web-vital',
          message: `TTFB: ${metric.value}ms`,
          level: 'info',
          data: metric,
        });
      });
    });

    // Monitor resource loading
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          // Log slow resources
          if (resourceEntry.duration > 1000) {
            Sentry.addBreadcrumb({
              category: 'performance',
              message: `Slow resource: ${resourceEntry.name}`,
              level: 'warning',
              data: {
                duration: resourceEntry.duration,
                size: resourceEntry.transferSize,
                type: resourceEntry.initiatorType,
              },
            });
          }
        }
      });
    });

    observer.observe({ entryTypes: ['resource'] });
  }

  // User context management
  setUser(user: {
    id: string;
    email?: string;
    username?: string;
    role?: string;
    [key: string]: any;
  }): void {
    Sentry.setUser(user);
  }

  clearUser(): void {
    Sentry.setUser(null);
  }

  // Custom event tracking
  trackEvent(name: string, data?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: name,
      level: 'info',
      data,
    });
  }

  // Geological-specific tracking
  trackGeologicalEvent(
    event: string,
    context: {
      projectId?: string;
      siteId?: string;
      depositId?: string;
      mineralType?: string;
      analysisType?: string;
      [key: string]: any;
    }
  ): void {
    Sentry.addBreadcrumb({
      category: 'geological',
      message: event,
      level: 'info',
      data: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // AI/ML tracking
  trackAIEvent(
    event: string,
    context: {
      modelName?: string;
      predictionType?: string;
      confidence?: number;
      processingTime?: number;
      [key: string]: any;
    }
  ): void {
    Sentry.addBreadcrumb({
      category: 'ai-analysis',
      message: event,
      level: 'info',
      data: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Map interaction tracking
  trackMapEvent(
    event: string,
    context: {
      mapProvider?: string;
      coordinates?: { lat: number; lng: number };
      zoomLevel?: number;
      layerType?: string;
      [key: string]: any;
    }
  ): void {
    Sentry.addBreadcrumb({
      category: 'map-interaction',
      message: event,
      level: 'info',
      data: {
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Performance measurement
  measurePerformance<T>(
    name: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const transaction = Sentry.startTransaction({
      name,
      op: 'custom',
      data: context,
    });

    const startTime = performance.now();

    return operation()
      .then((result) => {
        const duration = performance.now() - startTime;
        
        transaction.setData('duration', duration);
        transaction.setStatus('ok');
        
        // Log slow operations
        if (duration > 1000) {
          Sentry.addBreadcrumb({
            category: 'performance',
            message: `Slow operation: ${name}`,
            level: 'warning',
            data: { duration, ...context },
          });
        }
        
        return result;
      })
      .catch((error) => {
        transaction.setStatus('internal_error');
        Sentry.captureException(error, {
          tags: { operation: name },
          extra: context,
        });
        throw error;
      })
      .finally(() => {
        transaction.finish();
      });
  }

  // Feature flag tracking
  trackFeatureFlag(flagName: string, value: boolean, context?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      category: 'feature-flag',
      message: `${flagName}: ${value}`,
      level: 'info',
      data: {
        flagName,
        value,
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Business metrics
  trackBusinessMetric(
    metric: string,
    value: number,
    unit?: string,
    context?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      category: 'business-metric',
      message: `${metric}: ${value}${unit ? ` ${unit}` : ''}`,
      level: 'info',
      data: {
        metric,
        value,
        unit,
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Error recovery tracking
  trackErrorRecovery(
    error: Error,
    recoveryAction: string,
    success: boolean,
    context?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      category: 'error-recovery',
      message: `Recovery ${success ? 'succeeded' : 'failed'}: ${recoveryAction}`,
      level: success ? 'info' : 'warning',
      data: {
        error: error.message,
        recoveryAction,
        success,
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Session tracking
  startSession(sessionData?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      category: 'session',
      message: 'Session started',
      level: 'info',
      data: {
        ...sessionData,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    });
  }

  endSession(sessionData?: Record<string, any>): void {
    Sentry.addBreadcrumb({
      category: 'session',
      message: 'Session ended',
      level: 'info',
      data: {
        ...sessionData,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Health check
  isHealthy(): boolean {
    return this.isInitialized && !!Sentry.getCurrentHub().getClient();
  }

  // Get monitoring stats
  getStats(): {
    initialized: boolean;
    environment: string;
    release?: string;
    userId?: string;
  } {
    const user = Sentry.getCurrentHub().getScope()?.getUser();
    
    return {
      initialized: this.isInitialized,
      environment: this.config.environment,
      release: this.config.release,
      userId: user?.id,
    };
  }
}

// Initialize monitoring service
export const initializeMonitoring = (config: MonitoringConfig): MonitoringService => {
  const monitoring = MonitoringService.getInstance(config);
  monitoring.initialize();
  return monitoring;
};

// Export singleton instance
export const monitoring = MonitoringService.getInstance();

export default MonitoringService;