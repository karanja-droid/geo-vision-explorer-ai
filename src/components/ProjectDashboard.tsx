import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Plus,
  FolderOpen,
  Calendar,
  DollarSign,
  Users,
  MapPin,
  TrendingUp,
  Activity
} from "lucide-react";
import { useProjects, Project } from '@/hooks/useProjects';
import { ProjectForm } from './ProjectForm';
import { ProjectList } from './ProjectList';

const ProjectDashboard = () => {
  const { projects, loading, getProjectStats, selectedProject, setSelectedProject } = useProjects();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const stats = getProjectStats();

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'planning': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'suspended': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-slate-600 rounded w-3/4"></div>
                  <div className="h-8 bg-slate-600 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-600 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Project Dashboard</h2>
          <p className="text-slate-400">Manage your mineral exploration projects</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Total Projects
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
            <p className="text-xs text-slate-400">Across all statuses</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Active Projects
            </CardTitle>
            <Activity className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats.active}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={stats.total > 0 ? (stats.active / stats.total) * 100 : 0} 
                className="h-1 bg-slate-700 flex-1"
              />
              <span className="text-xs text-slate-400">
                {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Completed
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">{stats.completed}</div>
            <p className="text-xs text-slate-400">Successfully finished</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              Total Budget
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {formatCurrency(stats.totalBudget)}
            </div>
            <p className="text-xs text-slate-400">Allocated funds</p>
          </CardContent>
        </Card>
      </div>

      {/* Project List and Selected Project Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProjectList 
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            getStatusColor={getStatusColor}
          />
        </div>
        
        <div>
          {selectedProject ? (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center justify-between">
                  {selectedProject.name}
                  <Badge variant="secondary" className={getStatusColor(selectedProject.status)}>
                    {selectedProject.status}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {selectedProject.description || 'No description provided'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProject.budget && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-yellow-400" />
                    <span className="text-slate-300">Budget:</span>
                    <span className="text-slate-100 font-medium">
                      {formatCurrency(selectedProject.budget)}
                    </span>
                  </div>
                )}
                
                {selectedProject.start_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300">Start Date:</span>
                    <span className="text-slate-100">
                      {new Date(selectedProject.start_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {selectedProject.end_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-red-400" />
                    <span className="text-slate-300">End Date:</span>
                    <span className="text-slate-100">
                      {new Date(selectedProject.end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-600">
                  <p className="text-xs text-slate-500">
                    Created: {new Date(selectedProject.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Updated: {new Date(selectedProject.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Select a project to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Project Form Dialog */}
      {showCreateForm && (
        <ProjectForm 
          open={showCreateForm}
          onOpenChange={setShowCreateForm}
        />
      )}
    </div>
  );
};

export default ProjectDashboard;