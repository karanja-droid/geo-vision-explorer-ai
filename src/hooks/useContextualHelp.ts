import { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { helpManager, HelpContent, HelpContext } from '@/lib/contextual-help';
import { useAuth } from './useAuth';

export interface UseContextualHelpOptions {
  autoShow?: boolean;
  delay?: number;
  conditions?: Record<string, any>;
}

export function useContextualHelp(
  contentId?: string,
  options: UseContextualHelpOptions = {}
) {
  const location = useLocation();
  const { user } = useAuth();
  const elementRef = useRef<HTMLElement>(null);
  const { autoShow = true, delay = 2000, conditions = {} } = options;

  // Get current context
  const getContext = useCallback((): HelpContext => {
    return {
      route: location.pathname,
      userRole: user?.user_metadata?.role || 'geologist',
      subscription: user?.user_metadata?.subscription || 'individual',
      activeFeatures: [], // This would come from feature flags
      recentActions: [], // This would come from user activity tracking
      errorHistory: [], // This would come from error tracking
      sessionDuration: Date.now() - (user?.created_at ? new Date(user.created_at).getTime() : Date.now())
    };
  }, [location.pathname, user]);

  // Show help for specific content
  const showHelp = useCallback((id?: string, element?: HTMLElement) => {
    const targetId = id || contentId;
    if (!targetId) return;

    const targetElement = element || elementRef.current;
    helpManager.showHelp(targetId, targetElement || undefined);
  }, [contentId]);

  // Hide help
  const hideHelp = useCallback((id?: string) => {
    const targetId = id || contentId;
    if (!targetId) return;

    helpManager.hideHelp(targetId);
  }, [contentId]);

  // Get contextual help for current state
  const getContextualHelp = useCallback(() => {
    const context = getContext();
    return helpManager.getContextualHelp(context);
  }, [getContext]);

  // Search help content
  const searchHelp = useCallback((query: string) => {
    const context = getContext();
    return helpManager.searchHelp(query, context);
  }, [getContext]);

  // Track interaction
  const trackInteraction = useCallback((type: 'click' | 'complete' | 'helpful' | 'not_helpful', id?: string) => {
    const targetId = id || contentId;
    if (!targetId) return;

    helpManager.trackInteraction(targetId, type);
  }, [contentId]);

  // Register help content
  const registerHelp = useCallback((content: HelpContent) => {
    helpManager.registerContent(content);
  }, []);

  // Auto-show help based on conditions
  useEffect(() => {
    if (!contentId || !autoShow) return;

    const timer = setTimeout(() => {
      const context = getContext();
      const contextualHelp = helpManager.getContextualHelp(context);
      const shouldShow = contextualHelp.some(help => help.id === contentId);

      if (shouldShow) {
        showHelp();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [contentId, autoShow, delay, getContext, showHelp]);

  // Trigger help on route change
  useEffect(() => {
    if (!autoShow) return;

    // Dispatch route change event for help system
    document.dispatchEvent(new CustomEvent('help:route_change', {
      detail: { route: location.pathname }
    }));
  }, [location.pathname, autoShow]);

  return {
    elementRef,
    showHelp,
    hideHelp,
    getContextualHelp,
    searchHelp,
    trackInteraction,
    registerHelp,
    context: getContext()
  };
}

// Hook for help search functionality
export function useHelpSearch() {
  const { user } = useAuth();
  const location = useLocation();

  const search = useCallback((query: string) => {
    const context: HelpContext = {
      route: location.pathname,
      userRole: user?.user_metadata?.role || 'geologist',
      subscription: user?.user_metadata?.subscription || 'individual',
      activeFeatures: [],
      recentActions: [],
      errorHistory: [],
      sessionDuration: Date.now() - (user?.created_at ? new Date(user.created_at).getTime() : Date.now())
    };

    return helpManager.searchHelp(query, context);
  }, [location.pathname, user]);

  return { search };
}

// Hook for help analytics
export function useHelpAnalytics(contentId?: string) {
  const getAnalytics = useCallback(() => {
    return helpManager.getAnalytics(contentId);
  }, [contentId]);

  return { getAnalytics };
}

// Hook for managing help triggers
export function useHelpTrigger(action: string) {
  const triggerHelp = useCallback(() => {
    document.dispatchEvent(new CustomEvent(`help:${action}`));
  }, [action]);

  return { triggerHelp };
}