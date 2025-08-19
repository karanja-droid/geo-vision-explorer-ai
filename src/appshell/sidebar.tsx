/**
 * App Shell Sidebar - Navigation and context panels
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft,
  ChevronRight,
  Home,
  FolderOpen,
  Map,
  BarChart3,
  Settings,
  Users,
  Bell,
  Search,
  FileText,
  Layers,
  Zap,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { trackSidebarInteraction, trackNavigation } from './analytics';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string | number;
  children?: SidebarItem[];
  action?: () => void;
  disabled?: boolean;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  items?: SidebarItem[];
  className?: string;
}

const defaultSidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home className="w-4 h-4" />,
    path: '/'
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: <FolderOpen className="w-4 h-4" />,
    path: '/projects',
    badge: 12
  },
  {
    id: 'sites',
    label: 'Sites',
    icon: <Map className="w-4 h-4" />,
    path: '/sites',
    badge: 'New'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="w-4 h-4" />,
    path: '/analytics'
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: <Layers className="w-4 h-4" />,
    children: [
      {
        id: 'data-entry',
        label: 'Data Entry',
        icon: <FileText className="w-4 h-4" />,
        path: '/data-entry'
      },
      {
        id: 'imports',
        label: 'Bulk Import',
        icon: <Zap className="w-4 h-4" />,
        path: '/imports'
      }
    ]
  },
  {
    id: 'team',
    label: 'Team',
    icon: <Users className="w-4 h-4" />,
    path: '/team'
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield className="w-4 h-4" />,
    path: '/security'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="w-4 h-4" />,
    path: '/settings'
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggle,
  items = defaultSidebarItems,
  className
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed;
    onToggle?.(newState);
    trackSidebarInteraction(
      newState ? 'collapse' : 'expand',
      { state: newState ? 'collapsed' : 'expanded' }
    );
  }, [isCollapsed, onToggle]);

  const handleItemClick = useCallback((item: SidebarItem) => {
    if (item.disabled) return;

    if (item.children) {
      // Toggle expansion for items with children
      setExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    } else if (item.path) {
      // Navigate to path
      navigate(item.path);
      trackNavigation(item.path, { source: 'click' });
    } else if (item.action) {
      // Execute custom action
      item.action();
    }
  }, [navigate]);

  const isItemActive = useCallback((item: SidebarItem): boolean => {
    if (!item.path) return false;
    
    if (item.path === '/') {
      return location.pathname === '/';
    }
    
    return location.pathname.startsWith(item.path);
  }, [location.pathname]);

  const renderSidebarItem = (item: SidebarItem, level = 0) => {
    const isActive = isItemActive(item);
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        <Button
          variant={isActive ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start gap-2 h-9 px-2",
            level > 0 && "ml-4 w-[calc(100%-1rem)]",
            isCollapsed && level === 0 && "px-2 justify-center",
            item.disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => handleItemClick(item)}
          disabled={item.disabled}
        >
          <span className="flex-shrink-0">
            {item.icon}
          </span>
          
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left truncate">
                {item.label}
              </span>
              
              {item.badge && (
                <Badge 
                  variant={typeof item.badge === 'number' ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {item.badge}
                </Badge>
              )}
              
              {hasChildren && (
                <span className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronLeft className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </span>
              )}
            </>
          )}
        </Button>

        {/* Render children if expanded and not collapsed */}
        {hasChildren && isExpanded && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderSidebarItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={cn(
        "flex flex-col border-r bg-background transition-all duration-300",
        isCollapsed ? "w-12" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">G</span>
            </div>
            <span className="font-semibold text-sm">GeoVision AI</span>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 w-8 p-0"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {items.map(item => renderSidebarItem(item))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        {!isCollapsed ? (
          <div className="space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 text-xs"
            >
              <Bell className="w-3 h-3" />
              Notifications
              <Badge variant="destructive" className="ml-auto text-xs">
                3
              </Badge>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-8 text-xs"
            >
              <HelpCircle className="w-3 h-3" />
              Help & Support
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Button variant="ghost" size="sm" className="w-full h-8 p-0">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="w-full h-8 p-0">
              <HelpCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Hook for sidebar state management
export const useSidebar = (initialCollapsed = false) => {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  return {
    isCollapsed,
    toggle,
    collapse,
    expand,
    setIsCollapsed
  };
};