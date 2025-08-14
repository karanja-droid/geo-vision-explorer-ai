import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  MoreHorizontal,
  FileText,
  Map
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { DataTable } from '@/components/tables/DataTable';
import { useToast } from '@/hooks/use-toast';

interface DrillCollar {
  id: string;
  hole_id: string;
  easting: number;
  northing: number;
  elevation: number;
  total_depth: number;
  azimuth?: number;
  dip?: number;
  drill_date?: string;
  drill_type?: string;
  contractor?: string;
  status: string;
  country_code: string;
  data_classification: string;
  created_at: string;
  updated_at: string;
}

interface DrillCollarListProps {
  collars: DrillCollar[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (collar: DrillCollar) => void;
  onDelete: (collarId: string) => void;
  onView: (collar: DrillCollar) => void;
  onExport: (format: string, filters?: any) => void;
  onShowOnMap: (collar: DrillCollar) => void;
}

export function DrillCollarList({
  collars,
  isLoading = false,
  onAdd,
  onEdit,
  onDelete,
  onView,
  onExport,
  onShowOnMap
}: DrillCollarListProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [drillTypeFilter, setDrillTypeFilter] = useState<string>('all');
  const [selectedCollars, setSelectedCollars] = useState<string[]>([]);

  // Filter and search collars
  const filteredCollars = useMemo(() => {
    return collars.filter(collar => {
      const matchesSearch = collar.hole_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           collar.contractor?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || collar.status === statusFilter;
      const matchesDrillType = drillTypeFilter === 'all' || collar.drill_type === drillTypeFilter;
      
      return matchesSearch && matchesStatus && matchesDrillType;
    });
  }, [collars, searchTerm, statusFilter, drillTypeFilter]);

  // Get unique values for filters
  const uniqueStatuses = [...new Set(collars.map(c => c.status))];
  const uniqueDrillTypes = [...new Set(collars.map(c => c.drill_type).filter(Boolean))];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'drilling': return 'secondary';
      case 'planned': return 'outline';
      case 'abandoned': return 'destructive';
      default: return 'outline';
    }
  };

  const handleBulkExport = (format: string) => {
    const filters = {
      collar_ids: selectedCollars.length > 0 ? selectedCollars : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      drill_type: drillTypeFilter !== 'all' ? drillTypeFilter : undefined
    };
    onExport(format, filters);
  };

  const handleDeleteCollar = (collarId: string) => {
    if (window.confirm('Are you sure you want to delete this drill collar? This action cannot be undone.')) {
      onDelete(collarId);
      toast({
        title: "Collar Deleted",
        description: "Drill collar has been deleted successfully"
      });
    }
  };

  const columns = [
    {
      id: 'select',
      header: ({ table }: any) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => {
            table.toggleAllPageRowsSelected(e.target.checked);
            if (e.target.checked) {
              setSelectedCollars(filteredCollars.map(c => c.id));
            } else {
              setSelectedCollars([]);
            }
          }}
          className="rounded border-gray-300"
        />
      ),
      cell: ({ row }: any) => (
        <input
          type="checkbox"
          checked={selectedCollars.includes(row.original.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedCollars([...selectedCollars, row.original.id]);
            } else {
              setSelectedCollars(selectedCollars.filter(id => id !== row.original.id));
            }
          }}
          className="rounded border-gray-300"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'hole_id',
      header: 'Hole ID',
      cell: ({ row }: any) => (
        <div className="font-medium">{row.getValue('hole_id')}</div>
      ),
    },
    {
      accessorKey: 'easting',
      header: 'Easting',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('easting').toFixed(6)}</div>
      ),
    },
    {
      accessorKey: 'northing',
      header: 'Northing',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('northing').toFixed(6)}</div>
      ),
    },
    {
      accessorKey: 'elevation',
      header: 'Elevation (m)',
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('elevation').toFixed(1)}</div>
      ),
    },
    {
      accessorKey: 'total_depth',
      header: 'Depth (m)',
      cell: ({ row }: any) => (
        <div className="text-sm font-medium">{row.getValue('total_depth').toFixed(1)}</div>
      ),
    },
    {
      accessorKey: 'drill_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="text-xs">
          {row.getValue('drill_type') || 'N/A'}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => (
        <Badge variant={getStatusBadgeVariant(row.getValue('status'))}>
          {row.getValue('status')}
        </Badge>
      ),
    },
    {
      accessorKey: 'drill_date',
      header: 'Drill Date',
      cell: ({ row }: any) => (
        <div className="text-sm">
          {row.getValue('drill_date') ? 
            new Date(row.getValue('drill_date')).toLocaleDateString() : 
            'N/A'
          }
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => {
        const collar = row.original;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(collar)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowOnMap(collar)}>
                <Map className="mr-2 h-4 w-4" />
                Show on Map
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onEdit(collar)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => handleDeleteCollar(collar.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Drill Collars</h2>
          <Badge variant="secondary">{filteredCollars.length}</Badge>
        </div>
        <Button onClick={onAdd} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Collar
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by hole ID or contractor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={drillTypeFilter} onValueChange={setDrillTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueDrillTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkExport('csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkExport('xlsx')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkExport('gpkg')}>
                  <Map className="mr-2 h-4 w-4" />
                  Export as GeoPackage
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkExport('pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {selectedCollars.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                {selectedCollars.length} collar{selectedCollars.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filteredCollars}
            isLoading={isLoading}
            emptyMessage="No drill collars found"
            emptyDescription="Add your first drill collar to get started"
          />
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {filteredCollars.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {filteredCollars.length}
              </div>
              <p className="text-sm text-gray-600">Total Collars</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {filteredCollars.reduce((sum, collar) => sum + collar.total_depth, 0).toFixed(0)}m
              </div>
              <p className="text-sm text-gray-600">Total Meters</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {filteredCollars.filter(c => c.status === 'completed').length}
              </div>
              <p className="text-sm text-gray-600">Completed</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {filteredCollars.filter(c => c.status === 'drilling').length}
              </div>
              <p className="text-sm text-gray-600">In Progress</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}