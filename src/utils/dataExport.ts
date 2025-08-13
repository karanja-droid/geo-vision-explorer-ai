import { mockData, dataStatistics } from './mockData';
import { sampleDataGenerator } from './sampleDataGenerator';

export interface ExportOptions {
  format: 'json' | 'csv' | 'sql' | 'xlsx';
  tables?: string[];
  includeRelationships?: boolean;
  compressed?: boolean;
}

export class DataExporter {
  private static instance: DataExporter;

  static getInstance(): DataExporter {
    if (!DataExporter.instance) {
      DataExporter.instance = new DataExporter();
    }
    return DataExporter.instance;
  }

  // Export data in JSON format
  exportJSON(options: ExportOptions = { format: 'json' }): string {
    const data = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        statistics: dataStatistics,
        description: 'GeoVision AI Miner Sample Data Export'
      },
      profiles: mockData.profiles,
      projects: options.includeRelationships ? mockData.projectsWithSites : mockData.projects,
      sites: options.includeRelationships ? mockData.sitesWithDeposits : mockData.sites,
      deposits: options.includeRelationships ? mockData.depositsWithPredictions : mockData.deposits,
      predictions: mockData.predictions
    };

    return JSON.stringify(data, null, 2);
  }

  // Export data in CSV format
  exportCSV(tableName: string): string {
    const data = this.getTableData(tableName);
    if (!data || data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    // Convert data to CSV rows
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value.toString();
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  // Export data in SQL format
  exportSQL(): string {
    return sampleDataGenerator.exportToSQL();
  }

  // Export individual table data
  private getTableData(tableName: string): any[] {
    switch (tableName.toLowerCase()) {
      case 'profiles':
        return mockData.profiles;
      case 'projects':
        return mockData.projects;
      case 'sites':
      case 'exploration_sites':
        return mockData.sites;
      case 'deposits':
      case 'mineral_deposits':
        return mockData.deposits;
      case 'predictions':
        return mockData.predictions;
      default:
        return [];
    }
  }

  // Generate sample data files
  async generateDataFiles(): Promise<void> {
    const files = [
      {
        name: 'sample-data.json',
        content: this.exportJSON({ format: 'json', includeRelationships: true })
      },
      {
        name: 'sample-data.sql',
        content: this.exportSQL()
      },
      {
        name: 'profiles.csv',
        content: this.exportCSV('profiles')
      },
      {
        name: 'projects.csv',
        content: this.exportCSV('projects')
      },
      {
        name: 'sites.csv',
        content: this.exportCSV('sites')
      },
      {
        name: 'deposits.csv',
        content: this.exportCSV('deposits')
      },
      {
        name: 'predictions.csv',
        content: this.exportCSV('predictions')
      }
    ];

    // In a browser environment, create download links
    if (typeof window !== 'undefined') {
      files.forEach(file => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // In Node.js environment, write files
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        
        const outputDir = path.join(process.cwd(), 'sample-data-export');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        files.forEach(file => {
          const filePath = path.join(outputDir, file.name);
          fs.writeFileSync(filePath, file.content, 'utf8');
          console.log(`✅ Generated: ${filePath}`);
        });

        console.log(`\n🎉 All sample data files generated in: ${outputDir}`);
      } catch (error) {
        console.error('❌ Error generating files:', error);
      }
    }
  }

  // Generate data summary report
  generateSummaryReport(): string {
    const stats = dataStatistics;
    
    return `
# GeoVision AI Miner - Sample Data Summary Report

Generated: ${new Date().toISOString()}

## 📊 Data Overview

### Record Counts
- **Profiles**: ${stats.profiles.toLocaleString()} user profiles
- **Projects**: ${stats.projects.toLocaleString()} exploration projects  
- **Sites**: ${stats.sites.toLocaleString()} exploration sites
- **Deposits**: ${stats.deposits.toLocaleString()} mineral deposits
- **Predictions**: ${stats.predictions.toLocaleString()} AI predictions
- **Total Records**: ${stats.total.toLocaleString()}

### Data Diversity
- **Mineral Types**: ${stats.mineralTypes} different minerals
- **Site Types**: ${stats.siteTypes} site categories
- **Project Statuses**: ${stats.projectStatuses} status types
- **User Roles**: ${stats.userRoles} role types
- **Geographic Regions**: ${stats.regions} regions covered

### Quality Metrics
- **Average Confidence**: ${stats.averageConfidence.toFixed(1)}%
- **Average Grade**: ${stats.averageGrade.toFixed(2)}%
- **Average Tonnage**: ${stats.averageTonnage.toLocaleString()} tons

### Relationship Metrics
- **Sites per Project**: ${stats.averageSitesPerProject.toFixed(1)} average
- **Deposits per Site**: ${stats.averageDepositsPerSite.toFixed(1)} average  
- **Predictions per Deposit**: ${stats.averagePredictionsPerDeposit.toFixed(1)} average

## 🎯 Data Characteristics

### Realistic Geological Data
- Grade values based on real-world mineral deposit characteristics
- Tonnage calculations correlated with grade (higher grade = lower tonnage)
- Confidence levels distributed across realistic ranges
- Geographic coordinates focused on known mining regions

### AI Prediction Models
- 14 different AI model names representing various algorithms
- Confidence scores ranging from 40% to 98%
- Metadata including processing times, accuracy scores, and model versions
- Feature sets based on real geological exploration parameters

### Geographic Distribution
- Concentrated in major US mining regions (Nevada, Colorado, Arizona, Montana, Utah)
- Realistic elevation data for mountainous mining areas
- Proper coordinate relationships (sites near projects, deposits near sites)

### Temporal Data
- Creation dates spanning the last 2 years
- Project timelines with realistic start and end dates
- Discovery dates for mineral deposits
- Recent prediction timestamps

## 🔧 Technical Implementation

### Data Generation
- Faker.js for realistic fake data generation
- Geological domain knowledge for mineral-specific parameters
- Relationship integrity maintained across all tables
- PostGIS POINT geometry for spatial coordinates

### Export Formats
- **JSON**: Complete dataset with relationships
- **SQL**: Ready-to-import database migration
- **CSV**: Individual tables for spreadsheet analysis
- **Summary**: This human-readable report

### Database Integration
- Compatible with Supabase/PostgreSQL
- PostGIS spatial data support
- Proper foreign key relationships
- Optimized indexes for performance

## 📈 Usage Scenarios

This sample data supports:
- **Development**: Full-featured application testing
- **Demonstrations**: Realistic data for client presentations
- **Training**: User onboarding and feature exploration
- **Testing**: Comprehensive QA and performance testing
- **Analytics**: Dashboard and reporting development

---

*This data is generated for development and testing purposes only. All names, locations, and values are fictional.*
`;
  }
}

// Export singleton instance
export const dataExporter = DataExporter.getInstance();

// Utility functions for common export operations
export const exportUtils = {
  // Download JSON data
  downloadJSON: (filename: string = 'geovision-sample-data.json') => {
    const content = dataExporter.exportJSON({ format: 'json', includeRelationships: true });
    downloadFile(content, filename, 'application/json');
  },

  // Download SQL data
  downloadSQL: (filename: string = 'geovision-sample-data.sql') => {
    const content = dataExporter.exportSQL();
    downloadFile(content, filename, 'text/sql');
  },

  // Download CSV for specific table
  downloadCSV: (tableName: string, filename?: string) => {
    const content = dataExporter.exportCSV(tableName);
    const defaultFilename = `${tableName.toLowerCase()}.csv`;
    downloadFile(content, filename || defaultFilename, 'text/csv');
  },

  // Download summary report
  downloadSummary: (filename: string = 'data-summary-report.md') => {
    const content = dataExporter.generateSummaryReport();
    downloadFile(content, filename, 'text/markdown');
  },

  // Generate all files
  generateAll: () => {
    dataExporter.generateDataFiles();
  }
};

// Helper function to download files in browser
function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default dataExporter;