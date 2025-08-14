/**
 * Context Panel - Contextual information and actions sidebar
 */

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  X,
  Info,
  History,
  Users,
  MessageSquare,
  FileText,
  Map,
  BarChart3,
  Settings,
  ChevronRight,
  Clock,
  User,
  MapPin,
  Calendar
} from 'lucide-react';
import { trackContextPanel } from './analytics';

export interface ContextPanelItem {
  id: string;
  type: 'info' | 'history' | 'collaboration' | 'related' | 'actions';
  title: string;
  content: React.ReactNode;
  badge?: string | number;
  timestamp?: Date;
  user?: {
    name: string;
    avatar?: string;
  };
}

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  items?: ContextPanelItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  className?: string;
}

const sampleContextItems: ContextPanelItem[] = [
  {
    id: 'project-info',
    type: 'info',
    title: 'Project Details',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Northern Copper Ridge</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Started Jan 15, 2024</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Lead: Dr. Sarah Chen</span>
        </div>
        <div className="pt-2">
          <Badge variant="secondary">Active</Badge>
          <Badge variant="outline" className="ml-2">Phase 2</Badge>
        </div>
      </div>
    )
  },
  {
    id: 'recent-activity',
    type: 'history',
    title: 'Recent Activity',
    content: (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">Mineral analysis completed</p>
            <p className="text-xs text-muted-foreground">2 hours ago</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">Site survey uploaded</p>
            <p className="text-xs text-muted-foreground">1 day ago</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm">Team meeting scheduled</p>
            <p className="text-xs text-muted-foreground">2 days ago</p>
          </div>
        </div>
      </div>
    ),
    timestamp: new Date()
  },
  {
    id: 'team-members',
    type: 'collaboration',
    title: 'Team Members',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-medium">SC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Dr. Sarah Chen</p>
            <p className="text-xs text-muted-foreground">Project Lead</p>
          </div>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-medium">MJ</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Mike Johnson</p>
            <p className="text-xs text-muted-foreground">Geologist</p>
          </div>
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-medium">AL</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Anna Liu</p>
            <p className="text-xs text-muted-foreground">Data Analyst</p>
          </div>
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    ),
    badge: 3
  }
];

export const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  title = "Context",
  items = sampleContextItems,
  activeTab = "info",
  onTabChange,
  className
}) => {
  const [currentTab, setCurrentTab] = useState(activeTab);

  const handleTabChange = useCallback((tab: string) => {
    setCurrentTab(tab);
    onTabChange?.(tab);
    trackContextPanel('open', tab);
  }, [onTabChange]);

  const handleClose = useCallback(() => {
    onClose();
    trackContextPanel('close', currentTab);
  }, [onClose, currentTab]);

  // Group items by type
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ContextPanelItem[]>);

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info className="w-4 h-4" />;
      case 'history': return <History className="w-4 h-4" />;
      case 'collaboration': return <Users className="w-4 h-4" />;
      case 'related': return <FileText className="w-4 h-4" />;
      case 'actions': return <Settings className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getTabLabel = (type: string) => {
    switch (type) {
      case 'info': return 'Info';
      case 'history': return 'History';
      case 'collaboration': return 'Team';
      case 'related': return 'Related';
      case 'actions': return 'Actions';
      default: return type;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed right-0 top-0 h-full w-80 bg-background border-l shadow-lg z-50 transform transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold text-lg">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8 w-8 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 m-2">
            {Object.keys(groupedItems).slice(0, 3).map(type => (
              <TabsTrigger key={type} value={type} className="flex items-center gap-1">
                {getTabIcon(type)}
                <span className="hidden sm:inline">{getTabLabel(type)}</span>
                {groupedItems[type].some(item => item.badge) && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {groupedItems[type].reduce((sum, item) => 
                      sum + (typeof item.badge === 'number' ? item.badge : 1), 0
                    )}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(groupedItems).map(([type, typeItems]) => (
            <TabsContent key={type} value={type} className="flex-1 m-0">
              <ScrollArea className="h-full px-4 pb-4">
                <div className="space-y-4">
                  {typeItems.map(item => (
                    <div key={item.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{item.title}</h3>
                        {item.badge && (
                          <Badge variant="outline" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {item.content}
                      </div>
                      {item.timestamp && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {item.timestamp.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="border-t p-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2">
            <MessageSquare className="w-4 h-4" />
            Add Comment
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <FileText className="w-4 h-4" />
            Export Data
          </Button>
        </div>
      </div>
    </div>
  );
};

// Hook for context panel state management
export const useContextPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [items, setItems] = useState<ContextPanelItem[]>([]);

  const open = useCallback((tab?: string) => {
    setIsOpen(true);
    if (tab) setActiveTab(tab);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const updateItems = useCallback((newItems: ContextPanelItem[]) => {
    setItems(newItems);
  }, []);

  const addItem = useCallback((item: ContextPanelItem) => {
    setItems(prev => [...prev, item]);
  }, []);

  return {
    isOpen,
    activeTab,
    items,
    open,
    close,
    toggle,
    setActiveTab,
    updateItems,
    addItem
  };
};