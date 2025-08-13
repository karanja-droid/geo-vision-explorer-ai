import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle, AlertCircle, XCircle, Info, Zap, MapPin, TrendingUp, Users } from 'lucide-react';

// Enhanced toast types for geological operations
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'geological' | 'analysis' | 'collaboration';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

// Icon mapping for different toast types
const getToastIcon = (type: ToastType) => {
  const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
    loading: Zap,
    geological: MapPin,
    analysis: TrendingUp,
    collaboration: Users,
  };
  
  return iconMap[type] || Info;
};

// Enhanced toast function
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    const Icon = getToastIcon('success');
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      icon: <Icon className="w-4 h-4" />,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  error: (message: string, options?: ToastOptions) => {
    const Icon = getToastIcon('error');
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 6000,
      icon: <Icon className="w-4 h-4" />,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    const Icon = getToastIcon('warning');
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      icon: <Icon className="w-4 h-4" />,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  info: (message: string, options?: ToastOptions) => {
    const Icon = getToastIcon('info');
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      icon: <Icon className="w-4 h-4" />,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  loading: (message: string, options?: ToastOptions) => {
    const Icon = getToastIcon('loading');
    return sonnerToast.loading(message, {
      description: options?.description,
      icon: <Icon className="w-4 h-4 animate-spin" />,
    });
  },

  // Specialized geological toasts
  geological: {
    siteCreated: (siteName: string) => {
      return toast.success(`Site "${siteName}" created successfully`, {
        description: 'New geological site has been added to your project',
        action: {
          label: 'View Site',
          onClick: () => {
            // Navigate to site details
            console.log('Navigate to site:', siteName);
          },
        },
      });
    },

    mineralFound: (mineralType: string, confidence: number) => {
      const Icon = getToastIcon('geological');
      return sonnerToast.success(`${mineralType} detected!`, {
        description: `Confidence level: ${confidence}% - Analysis complete`,
        duration: 6000,
        icon: <Icon className="w-4 h-4 text-amber-600" />,
        action: {
          label: 'View Analysis',
          onClick: () => {
            console.log('View mineral analysis:', mineralType);
          },
        },
      });
    },

    analysisComplete: (analysisType: string, duration: number) => {
      const Icon = getToastIcon('analysis');
      return sonnerToast.success(`${analysisType} analysis complete`, {
        description: `Completed in ${duration}s - Results are ready for review`,
        duration: 5000,
        icon: <Icon className="w-4 h-4 text-green-600" />,
        action: {
          label: 'View Results',
          onClick: () => {
            console.log('View analysis results:', analysisType);
          },
        },
      });
    },

    dataProcessing: (dataType: string) => {
      const Icon = getToastIcon('loading');
      return sonnerToast.loading(`Processing ${dataType} data...`, {
        description: 'This may take a few minutes depending on data size',
        icon: <Icon className="w-4 h-4 animate-pulse text-blue-600" />,
      });
    },

    collaborationInvite: (userName: string, projectName: string) => {
      const Icon = getToastIcon('collaboration');
      return sonnerToast.info(`${userName} invited you to collaborate`, {
        description: `Project: ${projectName}`,
        duration: 8000,
        icon: <Icon className="w-4 h-4 text-purple-600" />,
        action: {
          label: 'Accept',
          onClick: () => {
            console.log('Accept collaboration invite');
          },
        },
        cancel: {
          label: 'Decline',
          onClick: () => {
            console.log('Decline collaboration invite');
          },
        },
      });
    },

    syncComplete: (itemCount: number) => {
      return toast.success('Data synchronization complete', {
        description: `${itemCount} items updated successfully`,
        action: {
          label: 'Refresh',
          onClick: () => {
            window.location.reload();
          },
        },
      });
    },

    exportReady: (fileName: string, format: string) => {
      return toast.success('Export ready for download', {
        description: `${fileName}.${format} has been generated`,
        action: {
          label: 'Download',
          onClick: () => {
            console.log('Download file:', fileName);
          },
        },
      });
    },

    subscriptionExpiring: (daysLeft: number) => {
      return toast.warning('Subscription expiring soon', {
        description: `Your subscription expires in ${daysLeft} days`,
        duration: 10000,
        action: {
          label: 'Renew',
          onClick: () => {
            console.log('Navigate to billing');
          },
        },
      });
    },

    quotaWarning: (percentage: number, quotaType: string) => {
      return toast.warning(`${quotaType} quota warning`, {
        description: `You've used ${percentage}% of your ${quotaType} quota`,
        duration: 8000,
        action: {
          label: 'Upgrade',
          onClick: () => {
            console.log('Navigate to upgrade');
          },
        },
      });
    },

    systemMaintenance: (startTime: string) => {
      return toast.info('Scheduled maintenance', {
        description: `System maintenance scheduled for ${startTime}`,
        duration: 10000,
        action: {
          label: 'Learn More',
          onClick: () => {
            console.log('Open maintenance info');
          },
        },
      });
    },
  },

  // Promise-based toast for async operations
  promise: <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
    });
  },

  // Dismiss specific toast
  dismiss: (toastId?: string | number) => {
    return sonnerToast.dismiss(toastId);
  },

  // Custom toast with full control
  custom: (jsx: React.ReactNode, options?: any) => {
    return sonnerToast.custom(jsx, options);
  },
};

// Specialized toast components for complex notifications
export const GeologicalAnalysisToast: React.FC<{
  analysisType: string;
  progress: number;
  onCancel?: () => void;
}> = ({ analysisType, progress, onCancel }) => {
  return (
    <div className="flex items-center space-x-3 p-2">
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border-2 border-muted"></div>
        <div 
          className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
          style={{ 
            background: `conic-gradient(from 0deg, transparent ${360 - (progress * 3.6)}deg, #3b82f6 ${360 - (progress * 3.6)}deg)` 
          }}
        ></div>
        <TrendingUp className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{analysisType} Analysis</p>
        <p className="text-xs text-muted-foreground">{progress}% complete</p>
      </div>
      {onCancel && (
        <button 
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export const CollaborationToast: React.FC<{
  userName: string;
  action: string;
  projectName: string;
  onAccept?: () => void;
  onDecline?: () => void;
}> = ({ userName, action, projectName, onAccept, onDecline }) => {
  return (
    <div className="space-y-3 p-2">
      <div className="flex items-center space-x-2">
        <Users className="w-4 h-4 text-purple-600" />
        <span className="font-medium text-sm">{userName} {action}</span>
      </div>
      <p className="text-xs text-muted-foreground">Project: {projectName}</p>
      {(onAccept || onDecline) && (
        <div className="flex space-x-2">
          {onAccept && (
            <button 
              onClick={onAccept}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Accept
            </button>
          )}
          {onDecline && (
            <button 
              onClick={onDecline}
              className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80"
            >
              Decline
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default toast;