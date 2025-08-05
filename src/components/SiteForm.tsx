import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Mountain, Ruler } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { Site, CreateSiteData, UpdateSiteData } from "@/hooks/useSites";

interface SiteFormProps {
  site?: Site;
  onSubmit: (data: CreateSiteData | UpdateSiteData) => Promise<void>;
  onCancel: () => void;
  selectedProjectId?: string;
}

const SiteForm: React.FC<SiteFormProps> = ({ site, onSubmit, onCancel, selectedProjectId }) => {
  const { projects } = useProjects();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    project_id: selectedProjectId || site?.project_id || '',
    name: site?.name || '',
    site_type: site?.site_type || 'drilling' as const,
    latitude: 0, // Will be extracted from PostGIS data
    longitude: 0, // Will be extracted from PostGIS data
    elevation: site?.elevation || undefined,
    access_notes: site?.access_notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create PostGIS point geometry
      const location = `SRID=4326;POINT(${formData.longitude} ${formData.latitude})`;

      if (site) {
        // Update existing site
        await onSubmit({
          id: site.id,
          name: formData.name,
          site_type: formData.site_type,
          location,
          elevation: formData.elevation,
          access_notes: formData.access_notes,
        });
      } else {
        // Create new site
        await onSubmit({
          project_id: formData.project_id,
          name: formData.name,
          site_type: formData.site_type,
          location,
          elevation: formData.elevation,
          access_notes: formData.access_notes,
        });
      }
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          {site ? 'Edit Site' : 'Create New Site'}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {site ? 'Update site information and location details' : 'Add a new exploration site to your project'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Selection (only for new sites) */}
          {!site && (
            <div className="space-y-2">
              <Label htmlFor="project" className="text-slate-300">Project *</Label>
              <Select 
                value={formData.project_id} 
                onValueChange={(value) => handleInputChange('project_id', value)}
                required
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-slate-100">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-slate-100">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Site Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300">Site Name *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-slate-100 focus:border-blue-500"
              placeholder="Enter site name"
              required
            />
          </div>

          {/* Site Type */}
          <div className="space-y-2">
            <Label htmlFor="site_type" className="text-slate-300">Site Type *</Label>
            <Select 
              value={formData.site_type} 
              onValueChange={(value) => handleInputChange('site_type', value)}
            >
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="drilling" className="text-slate-100">Drilling</SelectItem>
                <SelectItem value="surface_sampling" className="text-slate-100">Surface Sampling</SelectItem>
                <SelectItem value="geophysics" className="text-slate-100">Geophysics</SelectItem>
                <SelectItem value="geochemistry" className="text-slate-100">Geochemistry</SelectItem>
                <SelectItem value="remote_sensing" className="text-slate-100">Remote Sensing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude" className="text-slate-300 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Latitude *
              </Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value))}
                className="bg-slate-700/50 border-slate-600 text-slate-100 focus:border-blue-500"
                placeholder="-90 to 90"
                min="-90"
                max="90"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude" className="text-slate-300 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Longitude *
              </Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value))}
                className="bg-slate-700/50 border-slate-600 text-slate-100 focus:border-blue-500"
                placeholder="-180 to 180"
                min="-180"
                max="180"
                required
              />
            </div>
          </div>

          {/* Elevation */}
          <div className="space-y-2">
            <Label htmlFor="elevation" className="text-slate-300 flex items-center gap-1">
              <Mountain className="w-4 h-4" />
              Elevation (meters)
            </Label>
            <Input
              id="elevation"
              type="number"
              value={formData.elevation || ''}
              onChange={(e) => handleInputChange('elevation', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="bg-slate-700/50 border-slate-600 text-slate-100 focus:border-blue-500"
              placeholder="Enter elevation in meters"
            />
          </div>

          {/* Access Notes */}
          <div className="space-y-2">
            <Label htmlFor="access_notes" className="text-slate-300">Access Notes</Label>
            <Textarea
              id="access_notes"
              value={formData.access_notes}
              onChange={(e) => handleInputChange('access_notes', e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-slate-100 focus:border-blue-500 min-h-[100px]"
              placeholder="Add any access information, safety notes, or special instructions..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? 'Saving...' : (site ? 'Update Site' : 'Create Site')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SiteForm;