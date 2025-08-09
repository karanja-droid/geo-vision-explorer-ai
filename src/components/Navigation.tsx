
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Satellite, 
  Bell, 
  Settings, 
  User,
  Menu,
  LogOut,
  BarChart3,
  Folder,
  MapPin,
  Users,
  Shield
} from "lucide-react";

const Navigation = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { path: '/dashboard/projects', label: 'Projects', icon: Folder },
    { path: '/dashboard/sites', label: 'Sites', icon: MapPin },
    { path: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/dashboard/collaboration', label: 'Collaboration', icon: Users },
    { path: '/dashboard/security', label: 'Security', icon: Shield },
  ];

  return (
    <nav className="border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Satellite className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-100">GeoVision AI Miner</span>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
              AI
            </Badge>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button 
                  variant="ghost" 
                  className={`text-slate-300 hover:text-white hover:bg-slate-800 ${
                    isActive(item.path) ? 'bg-blue-600/20 text-blue-300' : ''
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2">
              <Badge variant="outline" className="border-green-500/50 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                Online
              </Badge>
            </div>
            
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <Bell className="w-4 h-4" />
            </Button>
            
            <Link to="/settings">
              <Button 
                variant="ghost" 
                size="sm" 
                className={`text-slate-400 hover:text-white ${
                  isActive('/settings') ? 'bg-blue-600/20 text-blue-300' : ''
                }`}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white md:hidden">
                  <Menu className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-slate-900 border-slate-700">
                <div className="flex flex-col space-y-4 mt-8">
                  {navigationItems.map((item) => (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button 
                        variant="ghost" 
                        className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 ${
                          isActive(item.path) ? 'bg-blue-600/20 text-blue-300' : ''
                        }`}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                  <Link 
                    to="/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Button 
                      variant="ghost" 
                      className={`w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 ${
                        isActive('/settings') ? 'bg-blue-600/20 text-blue-300' : ''
                      }`}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-sm">
                        <p className="text-slate-200 font-medium">{user?.email}</p>
                        <p className="text-slate-400 text-xs">Authenticated User</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={signOut}
                      className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-600/20"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-slate-700">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-sm">
                <p className="text-slate-200 font-medium">{user?.email}</p>
                <p className="text-slate-400 text-xs">Authenticated User</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="text-slate-400 hover:text-white ml-2"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
