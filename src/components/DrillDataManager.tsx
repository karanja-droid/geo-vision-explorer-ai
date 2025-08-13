/**
 * Drill Data Manager Component
 * 
 * Comprehensive interface for drill hole data management including:
 * - Data upload (collar, survey, interval, assay)
 * - QA validation and monitoring
 * - Report generation and viewing
 * - Issue resolution workflow
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Upload,
  PlayArrow,
  Assessment,
  Download,
  CheckCircle,
  Warning,
  Error,
  Info,
  Refresh,
  ExpandMore,
  Visibility,
  GetApp
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';

interface DrillHole {
  hole_id: string;
  longitude: number;
  latitude: number;
  elevation?: number;
  total_depth?: number;
  start_date?: string;
  drill_type?: string;
  contractor?: string;
  project?: string;
}

interface QAResult {
  id: string;
  hole_id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  status: 'open' | 'resolved' | 'ignored';
  created_at: string;
  rule_name?: string;
  details?: any;
}

interface QAReport {
  id: string;
  report_name: string;
  report_type: string;
  status: 'generating' | 'completed' | 'failed';
  total_holes: number;
  total_issues: number;
  error_count: number;
  warning_count: number;
  created_at: string;
  completed_at?: string;
  report_path?: string;
}

interface TaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message: string;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
  result?: any;
  error?: string;
}

const DrillDataManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [drillHoles, setDrillHoles] = useState<DrillHole[]>([]);
  const [qaResults, setQAResults] = useState<QAResult[]>([]);
  const [qaReports, setQAReports] = useState<QAReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<QAResult | null>(null);
  const [validationTask, setValidationTask] = useState<TaskStatus | null>(null);
  const [reportTask, setReportTask] = useState<TaskStatus | null>(null);
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    project_id: ''
  });

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDataType, setUploadDataType] = useState('collar');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load initial data
  useEffect(() => {
    loadDrillHoles();
    loadQAResults();
    loadQAReports();
  }, []);

  // Poll task status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (validationTask && ['pending', 'running'].includes(validationTask.status)) {
      interval = setInterval(() => {
        pollTaskStatus(validationTask.task_id, 'validation');
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [validationTask]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (reportTask && ['pending', 'running'].includes(reportTask.status)) {
      interval = setInterval(() => {
        pollTaskStatus(reportTask.task_id, 'report');
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [reportTask]);

  const loadDrillHoles = async () => {
    try {
      const response = await fetch('/api/v1/drill-data/holes');
      if (response.ok) {
        const data = await response.json();
        setDrillHoles(data.holes || []);
      }
    } catch (error) {
      console.error('Failed to load drill holes:', error);
    }
  };

  const loadQAResults = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.status) params.append('status', filters.status);
      if (filters.project_id) params.append('project_id', filters.project_id);
      
      const response = await fetch(`/api/v1/drill-data/qa/results?${params}`);
      if (response.ok) {
        const data = await response.json();
        setQAResults(data);
      }
    } catch (error) {
      console.error('Failed to load QA results:', error);
    }
  };

  const loadQAReports = async () => {
    try {
      const response = await fetch('/api/v1/drill-data/qa/reports');
      if (response.ok) {
        const data = await response.json();
        setQAReports(data);
      }
    } catch (error) {
      console.error('Failed to load QA reports:', error);
    }
  };

  const pollTaskStatus = async (taskId: string, taskType: 'validation' | 'report') => {
    try {
      const endpoint = taskType === 'validation' 
        ? `/api/v1/drill-data/qa/validate/status/${taskId}`
        : `/api/v1/drill-data/qa/reports/status/${taskId}`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const status = await response.json();
        
        if (taskType === 'validation') {
          setValidationTask(status);
          if (status.status === 'completed') {
            loadQAResults(); // Refresh QA results
          }
        } else {
          setReportTask(status);
          if (status.status === 'completed') {
            loadQAReports(); // Refresh reports
          }
        }
      }
    } catch (error) {
      console.error(`Failed to poll ${taskType} task status:`, error);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('data_type', uploadDataType);

      const response = await fetch('/api/v1/drill-data/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setUploadDialogOpen(false);
        setUploadFile(null);
        
        // Start monitoring validation task
        if (result.validation_task_id) {
          setValidationTask({
            task_id: result.validation_task_id,
            status: 'pending',
            message: 'QA validation started'
          });
        }
        
        // Refresh data
        loadDrillHoles();
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const startQAValidation = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/v1/drill-data/qa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: filters.project_id || null,
          hole_ids: null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setValidationTask({
          task_id: result.task_id,
          status: 'pending',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Failed to start QA validation:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQAReport = async (reportType: string = 'on_demand') => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/v1/drill-data/qa/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: filters.project_id || null,
          report_type: reportType
        })
      });

      if (response.ok) {
        const result = await response.json();
        setReportTask({
          task_id: result.task_id,
          status: 'pending',
          message: result.message
        });
        setReportDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to generate QA report:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveQAIssue = async (resultId: string, note: string) => {
    try {
      const response = await fetch(`/api/v1/drill-data/qa/results/${resultId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_note: note })
      });

      if (response.ok) {
        setResolveDialogOpen(false);
        setSelectedResult(null);
        loadQAResults(); // Refresh results
      }
    } catch (error) {
      console.error('Failed to resolve QA issue:', error);
    }
  };

  const downloadReport = async (reportId: string, format: string = 'html') => {
    try {
      const response = await fetch(`/api/v1/drill-data/qa/reports/${reportId}/download?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qa_report.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <Error />;
      case 'warning': return <Warning />;
      case 'info': return <Info />;
      default: return <Info />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'generating': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // File drop zone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  const renderDataUploadTab = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Drill Hole Data
              </Typography>
              
              <Box display="flex" gap={2} mb={2}>
                <Button
                  variant="contained"
                  startIcon={<Upload />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload Data
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadDrillHoles}
                >
                  Refresh
                </Button>
              </Box>

              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hole ID</TableCell>
                      <TableCell>Longitude</TableCell>
                      <TableCell>Latitude</TableCell>
                      <TableCell>Elevation</TableCell>
                      <TableCell>Total Depth</TableCell>
                      <TableCell>Drill Type</TableCell>
                      <TableCell>Start Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drillHoles.map((hole) => (
                      <TableRow key={hole.hole_id}>
                        <TableCell>{hole.hole_id}</TableCell>
                        <TableCell>{hole.longitude?.toFixed(6)}</TableCell>
                        <TableCell>{hole.latitude?.toFixed(6)}</TableCell>
                        <TableCell>{hole.elevation?.toFixed(1) || '-'}</TableCell>
                        <TableCell>{hole.total_depth?.toFixed(1) || '-'}</TableCell>
                        <TableCell>{hole.drill_type || '-'}</TableCell>
                        <TableCell>
                          {hole.start_date ? format(new Date(hole.start_date), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Summary
              </Typography>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Total Holes
                </Typography>
                <Typography variant="h4">
                  {drillHoles.length}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Data Types Available
                </Typography>
                <Box display="flex" gap={1} mt={1}>
                  <Chip label="Collars" size="small" />
                  <Chip label="Surveys" size="small" />
                  <Chip label="Intervals" size="small" />
                  <Chip label="Assays" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderQAValidationTab = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Quality Assurance
                </Typography>
                
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={startQAValidation}
                    disabled={loading}
                  >
                    Run QA Validation
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadQAResults}
                  >
                    Refresh
                  </Button>
                </Box>
              </Box>

              {/* Task Status */}
              {validationTask && (
                <Box mb={3}>
                  <Alert 
                    severity={
                      validationTask.status === 'completed' ? 'success' :
                      validationTask.status === 'failed' ? 'error' : 'info'
                    }
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Typography variant="body2">
                        {validationTask.message}
                      </Typography>
                      {validationTask.status === 'running' && (
                        <CircularProgress size={16} />
                      )}
                    </Box>
                    
                    {validationTask.progress && (
                      <Box mt={1}>
                        <LinearProgress 
                          variant="determinate" 
                          value={(validationTask.progress.current / validationTask.progress.total) * 100}
                        />
                        <Typography variant="caption" display="block" mt={0.5}>
                          {validationTask.progress.status}
                        </Typography>
                      </Box>
                    )}
                  </Alert>
                </Box>
              )}

              {/* Filters */}
              <Box display="flex" gap={2} mb={3}>
                <FormControl size="small" style={{ minWidth: 120 }}>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={filters.severity}
                    onChange={(e) => setFilters({...filters, severity: e.target.value})}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="error">Error</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="info">Info</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" style={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => setFilters({...filters, status: e.target.value})}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="ignored">Ignored</MenuItem>
                  </Select>
                </FormControl>
                
                <Button
                  variant="outlined"
                  onClick={loadQAResults}
                  size="small"
                >
                  Apply Filters
                </Button>
              </Box>

              {/* QA Results */}
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hole ID</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>Rule</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {qaResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.hole_id}</TableCell>
                        <TableCell>
                          <Chip
                            icon={getSeverityIcon(result.severity)}
                            label={result.severity}
                            color={getSeverityColor(result.severity) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{result.rule_name || '-'}</TableCell>
                        <TableCell>
                          <Tooltip title={result.message}>
                            <Typography variant="body2" noWrap style={{ maxWidth: 200 }}>
                              {result.message}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={result.status}
                            color={result.status === 'resolved' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {format(new Date(result.created_at), 'MMM dd, HH:mm')}
                        </TableCell>
                        <TableCell>
                          {result.status === 'open' && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedResult(result);
                                setResolveDialogOpen(true);
                              }}
                            >
                              <CheckCircle />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderReportsTab = () => (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  QA Reports
                </Typography>
                
                <Button
                  variant="contained"
                  startIcon={<Assessment />}
                  onClick={() => setReportDialogOpen(true)}
                >
                  Generate Report
                </Button>
              </Box>

              {/* Report Generation Status */}
              {reportTask && (
                <Box mb={3}>
                  <Alert 
                    severity={
                      reportTask.status === 'completed' ? 'success' :
                      reportTask.status === 'failed' ? 'error' : 'info'
                    }
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      <Typography variant="body2">
                        {reportTask.message}
                      </Typography>
                      {reportTask.status === 'running' && (
                        <CircularProgress size={16} />
                      )}
                    </Box>
                    
                    {reportTask.progress && (
                      <Box mt={1}>
                        <LinearProgress 
                          variant="determinate" 
                          value={(reportTask.progress.current / reportTask.progress.total) * 100}
                        />
                        <Typography variant="caption" display="block" mt={0.5}>
                          {reportTask.progress.status}
                        </Typography>
                      </Box>
                    )}
                  </Alert>
                </Box>
              )}

              {/* Reports List */}
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Report Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Holes</TableCell>
                      <TableCell>Issues</TableCell>
                      <TableCell>Errors</TableCell>
                      <TableCell>Warnings</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {qaReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>{report.report_name}</TableCell>
                        <TableCell>
                          <Chip label={report.report_type} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={report.status}
                            color={getStatusColor(report.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{report.total_holes}</TableCell>
                        <TableCell>
                          <Badge badgeContent={report.total_issues} color="primary">
                            <Typography variant="body2">
                              {report.total_issues}
                            </Typography>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="error">
                            {report.error_count}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="warning.main">
                            {report.warning_count}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {format(new Date(report.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {report.status === 'completed' && (
                            <Box display="flex" gap={1}>
                              <Tooltip title="Download HTML">
                                <IconButton
                                  size="small"
                                  onClick={() => downloadReport(report.id, 'html')}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Download PDF">
                                <IconButton
                                  size="small"
                                  onClick={() => downloadReport(report.id, 'pdf')}
                                >
                                  <GetApp />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Drill Data Management
      </Typography>
      
      <Typography variant="body1" color="textSecondary" paragraph>
        Upload, validate, and manage drill hole data with comprehensive QA reporting.
      </Typography>

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Data Upload" />
        <Tab label="QA Validation" />
        <Tab label="Reports" />
      </Tabs>

      {activeTab === 0 && renderDataUploadTab()}
      {activeTab === 1 && renderQAValidationTab()}
      {activeTab === 2 && renderReportsTab()}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Upload Drill Data</DialogTitle>
        <DialogContent>
          <Box mb={3}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Data Type</InputLabel>
              <Select
                value={uploadDataType}
                onChange={(e) => setUploadDataType(e.target.value)}
              >
                <MenuItem value="collar">Collar Data</MenuItem>
                <MenuItem value="survey">Survey Data</MenuItem>
                <MenuItem value="interval">Interval Data</MenuItem>
                <MenuItem value="assay">Assay Data</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed #ccc',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: isDragActive ? '#f5f5f5' : 'transparent'
            }}
          >
            <input {...getInputProps()} />
            {uploadFile ? (
              <Box>
                <Typography variant="h6">{uploadFile.name}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </Box>
            ) : (
              <Box>
                <Upload sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Drop files here or click to browse
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Supports CSV and Excel files
                </Typography>
              </Box>
            )}
          </Box>

          {uploadProgress > 0 && (
            <Box mt={2}>
              <LinearProgress variant="determinate" value={uploadProgress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleFileUpload}
            variant="contained"
            disabled={!uploadFile || loading}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)}>
        <DialogTitle>Generate QA Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Generate a comprehensive QA report for drill hole data validation results.
          </Typography>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Report Type</InputLabel>
            <Select defaultValue="on_demand">
              <MenuItem value="on_demand">On Demand</MenuItem>
              <MenuItem value="summary">Summary</MenuItem>
              <MenuItem value="detailed">Detailed</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => generateQAReport('on_demand')}
            variant="contained"
            disabled={loading}
          >
            Generate Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resolve Issue Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve QA Issue</DialogTitle>
        <DialogContent>
          {selectedResult && (
            <Box>
              <Typography variant="body2" paragraph>
                <strong>Hole:</strong> {selectedResult.hole_id}
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>Issue:</strong> {selectedResult.message}
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Resolution Note"
                placeholder="Describe how this issue was resolved..."
                margin="normal"
                id="resolution-note"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const note = (document.getElementById('resolution-note') as HTMLInputElement)?.value || '';
              if (selectedResult) {
                resolveQAIssue(selectedResult.id, note);
              }
            }}
            variant="contained"
            color="success"
          >
            Resolve Issue
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrillDataManager;