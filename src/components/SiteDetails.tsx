import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MapPin, 
  Mountain, 
  Calendar, 
  User, 
  Edit, 
  Trash2,
  FileText,
  ExternalLink
} from "lucide-react";
import { Site } from "@/hooks/useSites";
import { useProjects } from "@/hooks/useProjects";

interface SiteDetailsProps {
  site: Site;
  onBack: () => void;
  onEdit: (site: Site) => void;
  onDelete: (siteId: string) => void;
}

const SiteDetails: React.FC<SiteDetailsProps> = ({ site, onBack, onEdit, onDelete }) => {
  const { projects } = useProjects();
  
  const project = projects.find(p => p.id === site.project_id);

  const getSiteTypeLabel = (type: string) => {
    const labels = {
      drilling: 'Drilling',
      surface_sampling: 'Surface Sampling',
      geophysics: 'Geophysics',
      geochemistry: 'Geochemistry',
      remote_sensing: 'Remote Sensing'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getSiteTypeColor = (type: string) => {
    const colors = {
      drilling: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      surface_sampling: 'bg-green-500/20 text-green-300 border-green-500/30',
      geophysics: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      geochemistry: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      remote_sensing: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      onDelete(site.id);
      onBack();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sites
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-400" />
              {site.name}
            </h2>
            <p className="text-slate-400 mt-1">
              {project?.name || 'Unknown Project'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => onEdit(site)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Site
          </Button>
          <Button 
            variant="outline"
            onClick={handleDelete}
            className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Site Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-400">Site Name</label>
              <p className="text-lg text-slate-100 mt-1">{site.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-slate-400">Site Type</label>
              <div className="mt-1">
                <Badge className={getSiteTypeColor(site.site_type)}>
                  {getSiteTypeLabel(site.site_type)}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-400">Project</label>
              <p className="text-slate-100 mt-1">{project?.name || 'Unknown Project'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400">Created</label>
                <div className="flex items-center gap-1 text-slate-100 mt-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(site.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400">Last Updated</label>
                <div className="flex items-center gap-1 text-slate-100 mt-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(site.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Information */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Location Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400">Latitude</label>
                <div className="flex items-center gap-1 text-slate-100 mt-1">
                  <MapPin className="w-4 h-4" />
                  Available in PostGIS format
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400">Longitude</label>
                <div className="flex items-center gap-1 text-slate-100 mt-1">
                  <MapPin className="w-4 h-4" />
                  Available in PostGIS format
                </div>
              </div>
            </div>

            {site.elevation && (
              <div>
                <label className="text-sm font-medium text-slate-400">Elevation</label>
                <div className="flex items-center gap-1 text-slate-100 mt-1">
                  <Mountain className="w-4 h-4" />
                  {site.elevation} meters
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-400">Coordinates</label>
              <div className="bg-slate-700/50 p-3 rounded-lg mt-1">
                <code className="text-sm text-slate-300">
                  PostGIS Geometry Data Available
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-2 text-slate-400 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(site.location));
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div>
              <Button 
                variant="outline" 
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                onClick={() => {
                  // Note: Would need to extract coordinates from PostGIS data
                  alert('Coordinate extraction from PostGIS data needed for map integration');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Google Maps
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Access Notes */}
      {site.access_notes && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Access Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-700/50 p-4 rounded-lg">
              <p className="text-slate-300 whitespace-pre-wrap">{site.access_notes}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Information Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placeholder for Mineral Deposits */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">Mineral Deposits</CardTitle>
            <CardDescription className="text-slate-400">
              Associated mineral deposits and findings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-slate-400">No mineral deposits recorded yet</p>
              <Button variant="outline" className="mt-4 border-slate-600 text-slate-300">
                Add Deposit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder for Predictions */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100">AI Predictions</CardTitle>
            <CardDescription className="text-slate-400">
              ML predictions and analysis results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-slate-400">No predictions available yet</p>
              <Button variant="outline" className="mt-4 border-slate-600 text-slate-300">
                Run Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SiteDetails;