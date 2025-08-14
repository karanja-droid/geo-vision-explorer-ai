/**
 * Breadcrumb Navigation - Shows current location hierarchy
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trackNavigation } from './analytics';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items = [],
  className
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-generate breadcrumbs from current path if no items provided
  const breadcrumbItems = items.length > 0 ? items : generateBreadcrumbs(location.pathname);

  const handleNavigation = (path: string) => {
    navigate(path);
    trackNavigation(path, 'breadcrumb');
  };

  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          {item.path ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation(item.path!)}
              className="h-auto p-1 font-normal hover:bg-accent"
            >
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </Button>
          ) : (
            <span className="px-1 text-muted-foreground">
              {item.icon && <span className="mr-1">{item.icon}</span>}
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// Helper function to generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', path: '/', icon: <Home className="w-4 h-4" /> }
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    breadcrumbs.push({
      label: formatSegment(segment),
      path: isLast ? undefined : currentPath
    });
  });

  return breadcrumbs;
}

function formatSegment(segment: string): string {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}