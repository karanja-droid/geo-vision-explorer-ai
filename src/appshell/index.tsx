/**
 * App Shell - Main layout component with all shell features
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar, useSidebar } from './sidebar';
import { Header } from './header';
import { CommandPalette, useCommandPalette } from './command-palette';
import { ContextPanel, useContextPanel } from './context-panel';
import { Breadcrumb } from './breadcrumb';
import { StatusBar } from './status-bar';
import { useKeyboardShortcuts } from './keyboard';
import { trackPerformance } from './analytics';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  className
}) => {
  const sidebar = useSidebar();
  const commandPalette = useCommandPalette();
  const contextPanel = useContextPanel();
  const [isLoading, setIsLoading] = useState(false);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: commandPalette.open,
    onSidebarToggle: sidebar.toggle,
    onContextPanelToggle: contextPanel.toggle
  });

  // Track performance metrics
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      trackPerformance('app_shell_render', loadTime, 'initial_load');
    };
  }, []);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        sidebar.collapse();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check initial size

    return () => window.removeEventListener('resize', handleResize);
  }, [sidebar]);

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <Header onCommandPaletteOpen={commandPalette.open} />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={sidebar.isCollapsed}
          onToggle={sidebar.setIsCollapsed}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb */}
          <div className="border-b px-4 py-2">
            <Breadcrumb />
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              children
            )}
          </main>
        </div>

        {/* Context Panel */}
        <ContextPanel
          isOpen={contextPanel.isOpen}
          onClose={contextPanel.close}
          activeTab={contextPanel.activeTab}
          onTabChange={contextPanel.setActiveTab}
          items={contextPanel.items}
        />
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Overlay for mobile when panels are open */}
      {(contextPanel.isOpen || (!sidebar.isCollapsed && window.innerWidth < 768)) && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => {
            contextPanel.close();
            sidebar.collapse();
          }}
        />
      )}
    </div>
  );
};

// Export all components and hooks
export * from './sidebar';
export * from './header';
export * from './command-palette';
export * from './context-panel';
export * from './breadcrumb';
export * from './status-bar';
export * from './keyboard';
export * from './analytics';