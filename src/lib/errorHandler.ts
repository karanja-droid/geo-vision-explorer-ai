import * as Sentry from '@sentry/react';
import { toast } from '@/components/ui/enhanced-toast';

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  projectId?: string;
  additionalData?: Record<string, any>;
}

export interface ApiErrorInfo {
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  requestData?: any;
  responseData?: any;
}

export class ErrorHandler {
  private static isInitialized = false;

  static initialize() {
    if (this.isInitialized) return;

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_ENVIRONMENT || 'development',
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
      integrations: [
        new Sentry.BrowserTracing({
          // Set up automatic route change tracking for React Router
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes
          ),
        }),
      ],
      beforeSend(event, hint) {
        // Filter out non-critical errors in development
        if (import.meta.env.DEV) {
          const error = hint.originalException;
          if (error instanceof Error) {
            // Skip React DevTools errors
            if (error.message.includes('ResizeObserver loop limit exceeded')) {
              return null;
            }
            // Skip network errors that are expected
            if (error.message.includes('NetworkError') && error.message.includes('fetch')) {
              return null;
            }
          }
        }
        return event;
      },
    });

    this.isInitialized = true;
  }

  static captureError(error: Error, context?: ErrorContext) {
    console.error('Application Error:', error, context);
    
    // Set user context if available
    if (context?.userId) {
      Sentry.setUser({ id: context.userId });
    }

    // Set additional context
    Sentry.setContext('error_context', {
      component: context?.component,
      action: context?.action,
      projectId: context?.projectId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...context?.additionalData,
    });

    // Capture the exception
    Sentry.captureException(error, {
      tags: {
        component: context?.component,
        action: context?.action,
        error_type: 'application_error',
      },
      level: 'error',
    });

    // Show user-friendly error message
    this.showUserError(error, context);
  }

  static captureApiError(error: any, apiInfo: ApiErrorInfo, context?: ErrorContext) {
    console.error('API Error:', error, apiInfo);

    const errorInfo = {
      ...apiInfo,
      message: error.message || 'Unknown API error',
      timestamp: new Date().toISOString(),
      ...context?.additionalData,
    };

    // Set API context
    Sentry.setContext('api_error', errorInfo);

    // Capture the exception
    Sentry.captureException(error, {
      tags: {
        type: 'api_error',
        endpoint: apiInfo.endpoint,
        method: apiInfo.method,
        status: apiInfo.status?.toString(),
      },
      level: this.getErrorLevel(apiInfo.status),
      extra: errorInfo,
    });

    // Show appropriate user message based on error type
    this.showApiError(error, apiInfo);
  }

  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext) {
    console.log(`[${level.toUpperCase()}] ${message}`, context);

    Sentry.captureMessage(message, {
      level,
      tags: {
        component: context?.component,
        action: context?.action,
      },
      extra: context?.additionalData,
    });
  }

  static setUserContext(userId: string, email?: string, additionalData?: Record<string, any>) {
    Sentry.setUser({
      id: userId,
      email,
      ...additionalData,
    });
  }

  static addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  private static showUserError(error: Error, context?: ErrorContext) {
    // Determine appropriate user message based on error type
    let title = 'Something went wrong';
    let description = 'Our team has been notified. Please try again.';

    if (error.name === 'ValidationError') {
      title = 'Invalid input';
      description = 'Please check your input and try again.';
    } else if (error.name === 'NetworkError') {
      title = 'Connection problem';
      description = 'Please check your internet connection and try again.';
    } else if (error.name === 'AuthenticationError') {
      title = 'Authentication required';
      description = 'Please sign in to continue.';
    } else if (error.name === 'AuthorizationError') {
      title = 'Access denied';
      description = 'You don\'t have permission to perform this action.';
    }

    toast.error(title, {
      description,
      variant: 'destructive',
    });
  }

  private static showApiError(error: any, apiInfo: ApiErrorInfo) {
    const status = apiInfo.status;
    let title = 'Request failed';
    let description = 'Please try again later.';

    switch (status) {
      case 400:
        title = 'Invalid request';
        description = 'Please check your input and try again.';
        break;
      case 401:
        title = 'Authentication required';
        description = 'Please sign in to continue.';
        break;
      case 403:
        title = 'Access denied';
        description = 'You don\'t have permission to perform this action.';
        break;
      case 404:
        title = 'Not found';
        description = 'The requested resource could not be found.';
        break;
      case 409:
        title = 'Conflict';
        description = 'This action conflicts with existing data.';
        break;
      case 422:
        title = 'Validation error';
        description = 'Please check your input and try again.';
        break;
      case 429:
        title = 'Too many requests';
        description = 'Please wait a moment before trying again.';
        break;
      case 500:
        title = 'Server error';
        description = 'Our team has been notified. Please try again later.';
        break;
      case 502:
      case 503:
      case 504:
        title = 'Service unavailable';
        description = 'The service is temporarily unavailable. Please try again later.';
        break;
      default:
        if (status && status >= 500) {
          title = 'Server error';
          description = 'Our team has been notified. Please try again later.';
        }
    }

    toast.error(title, {
      description,
      variant: 'destructive',
    });
  }

  private static getErrorLevel(status?: number): 'info' | 'warning' | 'error' {
    if (!status) return 'error';
    
    if (status >= 500) return 'error';
    if (status >= 400) return 'warning';
    return 'info';
  }

  // Performance monitoring
  static startTransaction(name: string, operation: string) {
    return Sentry.startTransaction({
      name,
      op: operation,
    });
  }

  static measurePerformance<T>(
    name: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(name, operation);
    
    return fn()
      .then((result) => {
        transaction.setStatus('ok');
        return result;
      })
      .catch((error) => {
        transaction.setStatus('internal_error');
        this.captureError(error, { action: name });
        throw error;
      })
      .finally(() => {
        transaction.finish();
      });
  }

  // Geological-specific error handling
  static captureGeologicalError(
    error: Error,
    context: {
      projectId?: string;
      siteId?: string;
      depositId?: string;
      predictionId?: string;
      mineralType?: string;
      analysisType?: string;
    }
  ) {
    this.captureError(error, {
      component: 'geological_analysis',
      additionalData: {
        geological_context: context,
        analysis_timestamp: new Date().toISOString(),
      },
    });
  }

  static captureMapError(
    error: Error,
    context: {
      mapProvider?: string;
      coordinates?: { lat: number; lng: number };
      zoomLevel?: number;
      layerType?: string;
    }
  ) {
    this.captureError(error, {
      component: 'interactive_map',
      additionalData: {
        map_context: context,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
    });
  }

  static captureAIError(
    error: Error,
    context: {
      modelName?: string;
      inputFeatures?: string[];
      predictionType?: string;
      confidenceThreshold?: number;
    }
  ) {
    this.captureError(error, {
      component: 'ai_analysis',
      additionalData: {
        ai_context: context,
        model_timestamp: new Date().toISOString(),
      },
    });
  }
}

// React Error Boundary integration
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) => {
  // Remove JSX from .ts file - return component reference instead
  return Sentry.withErrorBoundary(Component, {
    fallback: fallback || (() => null), // Simple fallback to avoid JSX in .ts file
    beforeCapture: (scope, error, errorInfo) => {
      scope.setTag('errorBoundary', true);
      scope.setContext('errorInfo', errorInfo);
    },
  });
};

// Initialize error handler on module load
if (typeof window !== 'undefined') {
  ErrorHandler.initialize();
}

export default ErrorHandler;