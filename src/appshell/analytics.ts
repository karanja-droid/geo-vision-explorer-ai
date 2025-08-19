/**
 * Analytics utilities for app shell components
 */

interface AnalyticsEvent {
  name: string;
  duration: number;
  category: string;
  metadata?: Record<string, any>;
}

class AppShellAnalytics {
  private events: AnalyticsEvent[] = [];

  track(name: string, category: string, metadata?: Record<string, any>) {
    this.events.push({
      name,
      duration: 0,
      category,
      metadata
    });

    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${name}`, { category, metadata });
    }
  }

  trackPerformance(name: string, duration: number, category: string, metadata?: Record<string, any>) {
    this.events.push({
      name,
      duration,
      category,
      metadata
    });

    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${name}: ${duration}ms`, { category, metadata });
    }
  }
}

const analytics = new AppShellAnalytics();

// Export all the specific tracking functions needed by appshell components
export const trackPerformance = (name: string, duration: number, category: string, metadata?: Record<string, any>) => {
  analytics.trackPerformance(name, duration, category, metadata);
};

export const trackNavigation = (route: string, metadata?: Record<string, any>) => {
  analytics.track('navigation', 'user_action', { route, ...metadata });
};

export const trackCommandPaletteUsage = (action: string, metadata?: Record<string, any>) => {
  analytics.track('command_palette_usage', 'user_action', { action, ...metadata });
};

export const trackSearch = (query: string, results: number, metadata?: Record<string, any>) => {
  analytics.track('search', 'user_action', { query, results, ...metadata });
};

export const trackContextPanel = (action: string, panel: string, metadata?: Record<string, any>) => {
  analytics.track('context_panel', 'user_action', { action, panel, ...metadata });
};

export const trackUserInteraction = (element: string, action: string, metadata?: Record<string, any>) => {
  analytics.track('user_interaction', 'user_action', { element, action, ...metadata });
};

export const trackSidebarInteraction = (action: string, metadata?: Record<string, any>) => {
  analytics.track('sidebar_interaction', 'user_action', { action, ...metadata });
};

export default analytics;