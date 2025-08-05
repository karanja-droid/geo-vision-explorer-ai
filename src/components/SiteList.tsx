import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  MapPin, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye,
  Mountain,
  Calendar,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Site } from "@/hooks/useSites";
import { useProjects } from "@/hooks/useProjects";

interface SiteListProps {
  sites: Site[];
  loading: boolean;
  onEditSite: (site: Site) => void;
  onDeleteSite: (siteId: string) => void;
  onViewSite: (site: Site) => void;
  selectedProjectId?: string;
}

const SiteList: React.FC<SiteListProps> = ({ 
  sites, 
  loading, 
  onEditSite, 
  onDeleteSite, 
  onViewSite,
  selectedProjectId 
}) => {
  const { projects } = useProjects();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'updated_at' | 'site_type'>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Unknown Project';
  };

  const filteredAndSortedSites = sites
    .filter(site => {
      const matchesSearch = site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          getSiteTypeLabel(site.site_type).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterType === 'all' || site.site_type === filterType;
      const matchesProject = !selectedProjectId || site.project_id === selectedProjectId;
      return matchesSearch && matchesFilter && matchesProject;
    })
    .sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      if (sortField === 'updated_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: 'name' | 'updated_at' | 'site_type') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 ml-1" /> : 
      <ChevronDown className="w-4 h-4 ml-1" />;
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-8">
          <div className="text-center text-slate-400">Loading sites...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Exploration Sites
        </CardTitle>
        <CardDescription className="text-slate-400">
          Manage and view all exploration sites across your projects
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search sites..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-700/50 border-slate-600 text-slate-100"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-48 bg-slate-700/50 border-slate-600 text-slate-100">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-slate-100">All Types</SelectItem>
              <SelectItem value="drilling" className="text-slate-100">Drilling</SelectItem>
              <SelectItem value="surface_sampling" className="text-slate-100">Surface Sampling</SelectItem>
              <SelectItem value="geophysics" className="text-slate-100">Geophysics</SelectItem>
              <SelectItem value="geochemistry" className="text-slate-100">Geochemistry</SelectItem>
              <SelectItem value="remote_sensing" className="text-slate-100">Remote Sensing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sites Table */}
        {filteredAndSortedSites.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-300 mb-2">No sites found</h3>
            <p className="text-slate-400">
              {sites.length === 0 
                ? "No exploration sites have been created yet." 
                : "No sites match your current filters."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead 
                    className="text-slate-300 cursor-pointer hover:text-slate-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Site Name
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-slate-300 cursor-pointer hover:text-slate-100"
                    onClick={() => handleSort('site_type')}
                  >
                    <div className="flex items-center">
                      Type
                      <SortIcon field="site_type" />
                    </div>
                  </TableHead>
                  {!selectedProjectId && (
                    <TableHead className="text-slate-300">Project</TableHead>
                  )}
                  <TableHead className="text-slate-300">Location</TableHead>
                  <TableHead className="text-slate-300">Elevation</TableHead>
                  <TableHead 
                    className="text-slate-300 cursor-pointer hover:text-slate-100"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center">
                      Last Updated
                      <SortIcon field="updated_at" />
                    </div>
                  </TableHead>
                  <TableHead className="text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedSites.map((site) => (
                  <TableRow key={site.id} className="border-slate-700 hover:bg-slate-700/30">
                    <TableCell className="font-medium text-slate-100">
                      {site.name}
                    </TableCell>
                    <TableCell>
                      <Badge className={getSiteTypeColor(site.site_type)}>
                        {getSiteTypeLabel(site.site_type)}
                      </Badge>
                    </TableCell>
                    {!selectedProjectId && (
                      <TableCell className="text-slate-300">
                        {getProjectName(site.project_id)}
                      </TableCell>
                    )}
                    <TableCell className="text-slate-300">
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="w-3 h-3" />
                    Coordinates Available
                  </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {site.elevation ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Mountain className="w-3 h-3" />
                          {site.elevation}m
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-300">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {new Date(site.updated_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewSite(site)}
                          className="text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditSite(site)}
                          className="text-slate-400 hover:text-white hover:bg-slate-700"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteSite(site.id)}
                          className="text-slate-400 hover:text-red-400 hover:bg-slate-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SiteList;