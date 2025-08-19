import React from 'react';

/**
 * Keyboard shortcuts and command palette functionality
 */

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  category: string;
  roles?: string[];
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<any>;
  action: () => void;
  category: string;
  keywords: string[];
  roles?: string[];
  featureFlag?: string;
}

// Global keyboard shortcuts
export const KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcut> = {
  'cmd+k': {
    key: 'cmd+k',
    description: 'Open command palette',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'cmd+/': {
    key: 'cmd+/',
    description: 'Show keyboard shortcuts',
    action: () => {}, // Will be set by component
    category: 'Help'
  },
  'cmd+shift+p': {
    key: 'cmd+shift+p',
    description: 'Open command palette',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'cmd+b': {
    key: 'cmd+b',
    description: 'Toggle sidebar',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'cmd+shift+d': {
    key: 'cmd+shift+d',
    description: 'Go to dashboard',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'cmd+shift+m': {
    key: 'cmd+shift+m',
    description: 'Go to maps',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'cmd+shift+r': {
    key: 'cmd+shift+r',
    description: 'Go to reports',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  },
  'esc': {
    key: 'esc',
    description: 'Close modals/panels',
    action: () => {}, // Will be set by component
    category: 'Navigation'
  }
};

// Command categories
export const COMMAND_CATEGORIES = [
  'Navigation',
  'Data Entry',
  'Reports',
  'Analysis',
  'Settings',
  'Help'
];

// Utility functions for keyboard handling
export const formatShortcut = (shortcut: string): string => {
  return shortcut
    .replace('cmd', '⌘')
    .replace('ctrl', 'Ctrl')
    .replace('shift', '⇧')
    .replace('alt', '⌥')
    .replace('+', ' + ')
    .toUpperCase();
};

export const parseShortcut = (shortcut: string): string[] => {
  return shortcut.toLowerCase().split('+').map(key => key.trim());
};

export const matchesShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
  const keys = parseShortcut(shortcut);
  const eventKeys: string[] = [];
  
  if (event.metaKey || event.ctrlKey) eventKeys.push(event.metaKey ? 'cmd' : 'ctrl');
  if (event.shiftKey) eventKeys.push('shift');
  if (event.altKey) eventKeys.push('alt');
  eventKeys.push(event.key.toLowerCase());
  
  return keys.length === eventKeys.length && 
         keys.every(key => eventKeys.includes(key));
};

// Hook for keyboard shortcuts
export const useKeyboardShortcuts = (shortcuts: Record<string, () => void>) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }
      
      Object.entries(shortcuts).forEach(([shortcut, action]) => {
        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          action();
        }
      });
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Analytics event tracking for shortcuts
export const trackShortcutUsage = (shortcut: string, category: string) => {
  // Analytics implementation would go here
  console.log(`Shortcut used: ${shortcut} in category: ${category}`);
};