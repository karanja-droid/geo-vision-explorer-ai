import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Download, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { AdobePdfViewer } from '@/components/pdf/AdobePdfViewer';

interface ExportDialogProps {
  module: string;
  reportType: string;
  onClose: () => void;
  projectId?: string;
}

interface ExportJob {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  module: string;
  report_type: string;
  format: string;
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

interface Project {
  id: string;
  name: string;
}

export function ExportDialog({ module, reportType, onClose, projectId }: ExportDialogProps) {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch projects for dropdown
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/v1/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    }
  });

  // Poll export job status
  const { data: exportJob, refetch: refetchJob } = useQuery<ExportJob>({
    queryKey: ['export-job', currentJobId],
    queryFn: async () => {
      if (!currentJobId) return null;
      const response = await fetch(`/api/v1/exports/${currentJobId}`);
      if (!response.ok) throw new Error('Failed to fetch export job');
      return response.json();
    },
    enabled: !!currentJobId,
    refetchInterval: (data) => {
      // Poll every 2 seconds if job is pending or processing
      return data?.status === 'pending' || data?.status === 'processing' ? 2000 : false;
    }
  });

  // Create export mutation
  const createExportMutation = useMutation({
    mutationFn: async (params: {
      module: string;
      report_type: string;
      format: string;
      project_id?: string;
    }) => {
      const response = await fetch('/api/v1/exports/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) throw new Error('Failed to create export');
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentJobId(data.job_id);
      toast({
        title: 'Export Started',
        description: 'Your export is being processed...'
      });
    },
    onError: (error) => {
      toast({
        title: 'Export Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleExport = () => {
    createExportMutation.mutate({
      module,
      report_type: reportType,
      format: selectedFormat,
      project_id: selectedProject || undefined
    });
  };

  const handleDownload = () => {
    if (exportJob?.file_url) {
      const link = document.createElement('a');
      link.href = exportJob.file_url;
      link.download = `${module}_${reportType}.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePreview = () => {
    if (exportJob?.file_url && exportJob.mime_type === 'application/pdf') {
      setShowPreview(true);
    }
  };

  const getFormatOptions = () => {
    const baseFormats = [
      { value: 'pdf', label: 'PDF Report', icon: FileText },
      { value: 'csv', label: 'CSV Data', icon: Download },
      { value: 'xlsx', label: 'Excel Spreadsheet', icon: Download }
    ];

    // Add geo formats for certain modules
    if (['geologist', 'surveyor', 'geophysicist'].includes(module)) {
      baseFormats.push(
        { value: 'geojson', label: 'GeoJSON', icon: Download },
        { value: 'gpkg', label: 'GeoPackage', icon: Download }
      );
    }

    // Add specialized formats
    if (module === 'geophysicist') {
      baseFormats.push({ value: 'cog', label: 'Cloud Optimized GeoTIFF', icon: Download });
    }

    if (module === 'planner') {
      baseFormats.push({ value: 'glb', label: '3D Model (GLB)', icon: Download });
    }

    return baseFormats;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'processing':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (showPreview && exportJob?.file_url) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="w-full h-full max-w-6xl max-h-[95vh] bg-white rounded-lg overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="text-lg font-semibold">Export Preview</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" onClick={() => setShowPreview(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="h-[calc(100%-80px)]">
            <AdobePdfViewer
              fileUrl={exportJob.file_url}
              fileName={`${module}_${reportType}.pdf`}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Export {reportType.replace('_', ' ')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!currentJobId ? (
            <>
              {/* Project Selection */}
              {!projectId && (
                <div className="space-y-2">
                  <Label>Project (Optional)</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All projects</SelectItem>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Format Selection */}
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFormatOptions().map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        <div className="flex items-center gap-2">
                          <format.icon className="h-4 w-4" />
                          {format.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Export Button */}
              <Button 
                onClick={handleExport} 
                disabled={createExportMutation.isPending}
                className="w-full"
              >
                {createExportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting Export...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Start Export
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Export Status */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Export Status</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(exportJob?.status || 'pending')}
                    <Badge variant={getStatusColor(exportJob?.status || 'pending')}>
                      {exportJob?.status || 'pending'}
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                {exportJob?.status === 'processing' && (
                  <div className="space-y-2">
                    <Progress value={50} className="w-full" />
                    <p className="text-sm text-muted-foreground text-center">
                      Processing your export...
                    </p>
                  </div>
                )}

                {/* Export Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-medium">{exportJob?.format?.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{exportJob?.created_at ? new Date(exportJob.created_at).toLocaleString() : 'N/A'}</span>
                  </div>
                  {exportJob?.file_size && (
                    <div className="flex justify-between">
                      <span>File Size:</span>
                      <span>{formatFileSize(exportJob.file_size)}</span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {exportJob?.status === 'failed' && exportJob.error_message && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">{exportJob.error_message}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {exportJob?.status === 'completed' && (
                  <div className="flex gap-2">
                    <Button onClick={handleDownload} className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    {exportJob.mime_type === 'application/pdf' && (
                      <Button variant="outline" onClick={handlePreview}>
                        <FileText className="h-4 w-4 mr-2" />
                        Preview
                      </Button>
                    )}
                  </div>
                )}

                {exportJob?.status === 'failed' && (
                  <Button 
                    onClick={() => {
                      setCurrentJobId(null);
                      createExportMutation.reset();
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}