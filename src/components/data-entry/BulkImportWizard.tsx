/**
 * Bulk Data Import Wizard
 * 
 * Multi-step wizard for importing large datasets from various file formats
 * including CSV, Excel, and database files with validation and mapping
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Download,
  ArrowRight,
  ArrowLeft,
  Database,
  MapPin,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';

interface ImportStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface FileMapping {
  sourceColumn: string;
  targetField: string;
  dataType: string;
  required: boolean;
  validated: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  validRows: number;
}

const BulkImportWizard: React.FC = () => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [importType, setImportType] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<any[]>([]);
  const [columnMappings, setColumnMappings] = useState<FileMapping[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const steps: ImportStep[] = [
    {
      id: 'select-type',
      title: 'Select Import Type',
      description: 'Choose the type of data you want to import',
      completed: !!importType
    },
    {
      id: 'upload-file',
      title: 'Upload File',
      description: 'Upload your data file for processing',
      completed: !!uploadedFile
    },
    {
      id: 'map-columns',
      title: 'Map Columns',
      description: 'Map your file columns to database fields',
      completed: columnMappings.length > 0 && columnMappings.every(m => m.targetField)
    },
    {
      id: 'validate',
      title: 'Validate Data',
      description: 'Review and validate your data before import',
      completed: validationResults?.valid || false
    },
    {
      id: 'import',
      title: 'Import Data',
      description: 'Import your validated data into the system',
      completed: false
    }
  ];

  const importTypes = [
    {
      id: 'drilling',
      title: 'Drilling Data',
      description: 'Drill holes, surveys, and assay results',
      icon: Database,
      templates: ['drill_collar_template.csv', 'drill_survey_template.csv', 'drill_assay_template.csv']
    },
    {
      id: 'geochemistry',
      title: 'Geochemistry Data',
      description: 'Sample results and laboratory data',
      icon: FileText,
      templates: ['geochem_samples_template.csv', 'lab_results_template.csv']
    },
    {
      id: 'geology',
      title: 'Geological Data',
      description: 'Rock samples and field observations',
      icon: MapPin,
      templates: ['rock_samples_template.csv', 'structural_data_template.csv']
    }
  ];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      processFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });

  const processFile = async (file: File) => {
    try {
      // Mock file processing - in reality, you'd parse CSV/Excel here
      const mockData = [
        { 'Hole ID': 'DDH-001', 'Easting': '123456.78', 'Northing': '987654.32', 'Elevation': '1250.5' },
        { 'Hole ID': 'DDH-002', 'Easting': '123457.89', 'Northing': '987655.43', 'Elevation': '1251.2' },
        { 'Hole ID': 'DDH-003', 'Easting': '123458.90', 'Northing': '987656.54', 'Elevation': '1252.1' }
      ];
      
      setFileData(mockData);
      
      // Auto-generate column mappings
      const columns = Object.keys(mockData[0] || {});
      const mappings: FileMapping[] = columns.map(col => ({
        sourceColumn: col,
        targetField: '',
        dataType: 'string',
        required: false,
        validated: false
      }));
      
      setColumnMappings(mappings);
      
      toast({
        title: "File Processed",
        description: `Successfully processed ${file.name} with ${mockData.length} rows`,
      });
      
    } catch (error) {
      toast({
        title: "Processing Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    }
  };

  const validateData = async () => {
    try {
      // Mock validation - in reality, you'd validate against database schema
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Check required mappings
      const requiredMappings = columnMappings.filter(m => m.required);
      const missingMappings = requiredMappings.filter(m => !m.targetField);
      
      if (missingMappings.length > 0) {
        errors.push(`Missing required field mappings: ${missingMappings.map(m => m.sourceColumn).join(', ')}`);
      }
      
      // Mock data validation
      if (fileData.length === 0) {
        errors.push('No data rows found in file');
      }
      
      if (fileData.length > 10000) {
        warnings.push('Large dataset detected - import may take several minutes');
      }
      
      const validationResult: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
        rowCount: fileData.length,
        validRows: fileData.length - errors.length
      };
      
      setValidationResults(validationResult);
      
      if (validationResult.valid) {
        toast({
          title: "Validation Successful",
          description: `${validationResult.validRows} rows ready for import`,
        });
      } else {
        toast({
          title: "Validation Failed",
          description: `${errors.length} errors found`,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Failed to validate data",
        variant: "destructive"
      });
    }
  };

  const startImport = async () => {
    setImporting(true);
    setImportProgress(0);
    
    try {
      // Mock import process with progress updates
      for (let i = 0; i <= 100; i += 10) {
        setImportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${fileData.length} records`,
      });
      
      // Reset wizard
      setCurrentStep(0);
      setImportType('');
      setUploadedFile(null);
      setFileData([]);
      setColumnMappings([]);
      setValidationResults(null);
      
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import data",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    return steps[currentStep].completed;
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" />
            Bulk Data Import Wizard
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
            </p>
            <Progress value={(currentStep / (steps.length - 1)) * 100} className="w-32" />
          </div>
        </CardHeader>
      </Card>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {/* Step 1: Select Import Type */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Select Data Type</h3>
                <p className="text-gray-600">Choose the type of geological data you want to import</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {importTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <Card 
                      key={type.id} 
                      className={`cursor-pointer transition-all ${
                        importType === type.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                      }`}
                      onClick={() => setImportType(type.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <IconComponent className="h-12 w-12 mx-auto mb-3 text-blue-600" />
                        <h4 className="font-semibold mb-2">{type.title}</h4>
                        <p className="text-sm text-gray-600 mb-3">{type.description}</p>
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Templates:</p>
                          {type.templates.map((template, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {template}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Upload Data File</h3>
                <p className="text-gray-600">Upload your CSV or Excel file containing the data</p>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <p className="text-blue-600">Drop the file here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">Drag & drop your file here</p>
                    <p className="text-gray-600 mb-4">or click to browse files</p>
                    <p className="text-sm text-gray-500">Supports CSV, XLS, XLSX files up to 50MB</p>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">{uploadedFile.name}</p>
                      <p className="text-sm text-green-600">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • {fileData.length} rows detected
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Map Columns */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Map Columns</h3>
                <p className="text-gray-600">Map your file columns to the appropriate database fields</p>
              </div>

              <div className="space-y-4">
                {columnMappings.map((mapping, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Source Column</Label>
                      <p className="text-sm text-gray-600">{mapping.sourceColumn}</p>
                    </div>
                    <div>
                      <Label htmlFor={`target-${index}`}>Target Field</Label>
                      <Select
                        value={mapping.targetField}
                        onValueChange={(value) => {
                          const newMappings = [...columnMappings];
                          newMappings[index].targetField = value;
                          setColumnMappings(newMappings);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hole_id">Hole ID</SelectItem>
                          <SelectItem value="easting">Easting</SelectItem>
                          <SelectItem value="northing">Northing</SelectItem>
                          <SelectItem value="elevation">Elevation</SelectItem>
                          <SelectItem value="depth_from">Depth From</SelectItem>
                          <SelectItem value="depth_to">Depth To</SelectItem>
                          <SelectItem value="sample_id">Sample ID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`type-${index}`}>Data Type</Label>
                      <Select
                        value={mapping.dataType}
                        onValueChange={(value) => {
                          const newMappings = [...columnMappings];
                          newMappings[index].dataType = value;
                          setColumnMappings(newMappings);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      {mapping.targetField && (
                        <Badge variant="outline" className="text-green-600">
                          Mapped
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Validate */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Validate Data</h3>
                <p className="text-gray-600">Review validation results before importing</p>
              </div>

              {!validationResults ? (
                <div className="text-center">
                  <Button onClick={validateData}>
                    <Settings className="h-4 w-4 mr-2" />
                    Run Validation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={`border rounded-lg p-4 ${
                    validationResults.valid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      {validationResults.valid ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      )}
                      <h4 className="font-semibold">
                        {validationResults.valid ? 'Validation Passed' : 'Validation Failed'}
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Rows:</span> {validationResults.rowCount}
                      </div>
                      <div>
                        <span className="font-medium">Valid Rows:</span> {validationResults.validRows}
                      </div>
                    </div>
                  </div>

                  {validationResults.errors.length > 0 && (
                    <div className="border border-red-200 rounded-lg p-4">
                      <h5 className="font-medium text-red-800 mb-2">Errors</h5>
                      <ul className="space-y-1">
                        {validationResults.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResults.warnings.length > 0 && (
                    <div className="border border-yellow-200 rounded-lg p-4">
                      <h5 className="font-medium text-yellow-800 mb-2">Warnings</h5>
                      <ul className="space-y-1">
                        {validationResults.warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-yellow-600 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Import */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Import Data</h3>
                <p className="text-gray-600">Ready to import your validated data</p>
              </div>

              {importing ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-2">{importProgress}%</div>
                    <Progress value={importProgress} className="w-full max-w-md mx-auto" />
                    <p className="text-sm text-gray-600 mt-2">Importing data...</p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <CheckCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                    <h4 className="font-semibold text-blue-800 mb-2">Ready to Import</h4>
                    <p className="text-blue-600">
                      {validationResults?.validRows} rows will be imported into the {importType} module
                    </p>
                  </div>
                  
                  <Button onClick={startImport} size="lg">
                    <Upload className="h-5 w-5 mr-2" />
                    Start Import
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        <Button
          onClick={nextStep}
          disabled={currentStep === steps.length - 1 || !canProceed()}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default BulkImportWizard;