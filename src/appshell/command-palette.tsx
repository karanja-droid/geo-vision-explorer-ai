/**
 * Command Palette - Global search and command execution
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Command, 
  FileText, 
  Map, 
  Settings, 
  Users, 
  BarChart3,
  Zap,
  ArrowRight,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackCommandPaletteUsage, trackSearch } from './analytics';

export interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category: 'navigation' | 'action' | 'search' | 'recent';
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  priority?: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: CommandItem[];
}

const defaultCommands: CommandItem[] = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    description: 'Go to main dashboard',
    category: 'navigation',
    icon: <BarChart3 className="w-4 h-4" />,
    action: () => {},
    keywords: ['home', 'main', 'overview'],
    priority: 10
  },
  {
    id: 'nav-projects',
    title: 'Projects',
    description: 'Manage exploration projects',
    category: 'navigation',
    icon: <FileText className="w-4 h-4" />,
    action: () => {},
    keywords: ['exploration', 'manage'],
    priority: 9
  },
  {
    id: 'nav-sites',
    title: 'Sites',
    description: 'View geological sites',
    category: 'navigation',
    icon: <Map className="w-4 h-4" />,
    action: () => {},
    keywords: ['geological', 'locations'],
    priority: 8
  },
  {
    id: 'nav-settings',
    title: 'Settings',
    description: 'Application preferences',
    category: 'navigation',
    icon: <Settings className="w-4 h-4" />,
    action: () => {},
    keywords: ['preferences', 'config'],
    priority: 5
  }
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands = defaultCommands
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const navigate = useNavigate();

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then high priority commands
      const recent = commands.filter(cmd => recentCommands.includes(cmd.id));
      const others = commands
        .filter(cmd => !recentCommands.includes(cmd.id))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
      return [...recent, ...others].slice(0, 10);
    }

    const searchTerm = query.toLowerCase();
    return commands
      .filter(cmd => {
        const titleMatch = cmd.title.toLowerCase().includes(searchTerm);
        const descMatch = cmd.description?.toLowerCase().includes(searchTerm);
        const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchTerm));
        return titleMatch || descMatch || keywordMatch;
      })
      .sort((a, b) => {
        // Prioritize exact title matches
        const aExact = a.title.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        const bExact = b.title.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        
        // Then by priority
        return (b.priority || 0) - (a.priority || 0);
      })
      .slice(0, 10);
  }, [query, commands, recentCommands]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Execute command and track usage
  const executeCommand = useCallback((command: CommandItem) => {
    // Add to recent commands
    setRecentCommands(prev => {
      const updated = [command.id, ...prev.filter(id => id !== command.id)];
      return updated.slice(0, 5); // Keep only 5 recent commands
    });

    // Track analytics
    trackCommandPaletteUsage(command.title);
    if (query) {
      trackSearch(query, filteredCommands.length, { source: 'command_palette' });
    }

    // Execute the command
    if (command.category === 'navigation') {
      const path = command.id.replace('nav-', '/');
      navigate(path === '/dashboard' ? '/' : path);
    } else {
      command.action();
    }

    // Close palette
    onClose();
    setQuery('');
  }, [query, filteredCommands.length, navigate, onClose]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const getCategoryIcon = (category: CommandItem['category']) => {
    switch (category) {
      case 'navigation': return <ArrowRight className="w-3 h-3" />;
      case 'action': return <Zap className="w-3 h-3" />;
      case 'search': return <Search className="w-3 h-3" />;
      case 'recent': return <Clock className="w-3 h-3" />;
      default: return <Command className="w-3 h-3" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="w-4 h-4 text-muted-foreground mr-3" />
          <Input
            placeholder="Search commands, pages, and actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 text-base"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 text-xs">
            ⌘K
          </Badge>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
              {query && (
                <p className="text-sm mt-1">
                  Try searching for "dashboard", "projects", or "settings"
                </p>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredCommands.map((command, index) => (
                <div
                  key={command.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${index === selectedIndex 
                      ? 'bg-accent text-accent-foreground' 
                      : 'hover:bg-accent/50'
                    }
                  `}
                  onClick={() => executeCommand(command)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {command.icon || getCategoryIcon(command.category)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {command.title}
                      </div>
                      {command.description && (
                        <div className="text-sm text-muted-foreground truncate">
                          {command.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {recentCommands.includes(command.id) && (
                      <Badge variant="secondary" className="text-xs">
                        Recent
                      </Badge>
                    )}
                    {command.shortcut && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {command.shortcut}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {command.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ to navigate, ↵ to select, esc to close</span>
            <span>{filteredCommands.length} results</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Hook for using command palette
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return {
    isOpen,
    open,
    close,
    toggle
  };
};