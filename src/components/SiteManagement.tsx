import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, BarChart3 } from "lucide-react";
import { useSites } from "@/hooks/useSites";
import { useProjects } from "@/hooks/useProjects";
import SiteForm from "./SiteForm";
import SiteList from "./SiteList";
import SiteDetails from "./SiteDetails";

interface SiteManagementProps {
  selectedProjectId?: string;
}

const SiteManagement: React.FC<SiteManagementProps> = ({ selectedProjectId }) => {
  const { 
    sites, 
    loading, 
    selectedSite, 
    setSelectedSite,
    createSite, 
    updateSite, 
    deleteSite,
    getSiteStats 
  } = useSites();
  
  const { projects } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editingSite, setEditingSite] = useState(null);

  const filteredSites = selectedProjectId 
    ? sites.filter(site => site.project_id === selectedProjectId)
    : sites;

  const stats = getSiteStats();
  const currentProject = selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId)
    : null;

  const handleCreateSite = () => {
    setEditingSite(null);
    setShowForm(true);
  };

  const handleEditSite = (site) => {
    setEditingSite(site);
    setShowForm(true);
  };

  const handleFormSubmit = async (data) => {
    try {
      if (editingSite) {
        await updateSite(data);
      } else {
        await createSite(data);
      }
      setShowForm(false);
      setEditingSite(null);
    } catch (error) {
      // Error is already handled in the hook
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSite(null);
  };

  const handleDeleteSite = async (siteId: string) => {
    if (window.confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      await deleteSite(siteId);
    }
  };

  const handleViewSite = (site) => {
    setSelectedSite(site);
  };

  if (selectedSite) {
    return (
      <SiteDetails 
        site={selectedSite} 
        onBack={() => setSelectedSite(null)}
        onEdit={handleEditSite}
        onDelete={handleDeleteSite}
      />
    );
  }

  if (showForm) {
    return (
      <SiteForm
        site={editingSite}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        selectedProjectId={selectedProjectId}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            {currentProject ? `${currentProject.name} - Sites` : 'Site Management'}
          </h2>
          <p className="text-slate-400 mt-1">
            {currentProject 
              ? `Manage exploration sites for ${currentProject.name}`
              : 'Manage exploration sites across all projects'
            }
          </p>
        </div>
        <Button 
          onClick={handleCreateSite}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      {/* Site Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Sites</p>
                <p className="text-2xl font-bold text-slate-100">{filteredSites.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Drilling Sites</p>
                <p className="text-2xl font-bold text-slate-100">{stats.drilling}</p>
              </div>
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Sampling Sites</p>
                <p className="text-2xl font-bold text-slate-100">{stats.sampling}</p>
              </div>
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Geophysics</p>
                <p className="text-2xl font-bold text-slate-100">{stats.geophysics}</p>
              </div>
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site Types Overview */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100 text-lg">Site Types Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              Drilling: {stats.drilling}
            </Badge>
            <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
              Surface Sampling: {stats.sampling}
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              Geophysics: {stats.geophysics}
            </Badge>
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
              Geochemistry: {stats.geochemistry}
            </Badge>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30">
              Remote Sensing: {stats.remote_sensing}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Site List */}
      <SiteList
        sites={filteredSites}
        loading={loading}
        onEditSite={handleEditSite}
        onDeleteSite={handleDeleteSite}
        onViewSite={handleViewSite}
        selectedProjectId={selectedProjectId}
      />
    </div>
  );
};

export default SiteManagement;