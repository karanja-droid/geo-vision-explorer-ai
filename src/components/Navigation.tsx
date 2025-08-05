
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Satellite, 
  Bell, 
  Settings, 
  User,
  Menu,
  LogOut
} from "lucide-react";

const Navigation = () => {
  const { user, signOut } = useAuth();
  return (
    <nav className="border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Satellite className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-100">GeoVisionminer</span>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
              AI
            </Badge>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Dashboard
            </Button>
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Projects
            </Button>
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Exploration
            </Button>
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
              Analytics
            </Button>
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
            
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
              <Settings className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white md:hidden">
              <Menu className="w-4 h-4" />
            </Button>

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
