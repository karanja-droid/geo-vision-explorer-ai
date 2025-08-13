# 🗄️ GeoVision AI Miner - Sample Data Guide

## 📋 Overview

This guide covers the comprehensive sample data system for GeoVision AI Miner, including 1000+ realistic geological exploration records across all application features.

## 📊 Data Statistics

### Record Counts
- **👥 User Profiles**: 50 geological professionals with diverse roles
- **📁 Projects**: 100 exploration projects across major mining regions
- **🏔️ Exploration Sites**: 500 sites with realistic coordinates and elevations
- **💎 Mineral Deposits**: 800 deposits with accurate grade and tonnage data
- **🤖 AI Predictions**: 1,200 machine learning predictions with confidence scores
- **📈 Total Records**: 2,650+ interconnected data points

### Data Quality Features
- ✅ **Realistic Geological Data**: Grade values based on actual mineral deposit characteristics
- ✅ **Geographic Accuracy**: Coordinates focused on known US mining regions
- ✅ **Relationship Integrity**: Proper foreign key relationships maintained
- ✅ **Temporal Consistency**: Logical date sequences and timelines
- ✅ **Domain Expertise**: Geological terminology and industry standards

## 🎯 Key Features

### Mineral Diversity
- **47 Mineral Types**: From precious metals (Gold, Silver, Platinum) to industrial minerals
- **Realistic Grades**: Grade values appropriate for each mineral type
- **Tonnage Correlation**: Higher grades typically correlate with lower tonnages
- **Confidence Levels**: Distributed across realistic ranges (30-95%)

### Geographic Distribution
- **10 Major Mining Regions**: Nevada, Colorado, Arizona, Montana, Utah, and more
- **Elevation Data**: Realistic mountain elevations for mining areas
- **Spatial Relationships**: Sites clustered around projects, deposits near sites
- **PostGIS Integration**: Proper POINT geometry for spatial queries

### AI Predictions
- **14 AI Models**: Representing various machine learning algorithms
- **Confidence Scores**: 40-98% range with realistic distributions
- **Feature Sets**: Based on real geological exploration parameters
- **Metadata**: Processing times, accuracy scores, model versions

### User Roles & Expertise
- **7 Professional Roles**: Administrator, Geologist, Geophysicist, etc.
- **Skills & Certifications**: Industry-relevant expertise and credentials
- **Experience Levels**: 1-35 years of professional experience
- **Department Structure**: Realistic organizational hierarchy

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```bash
# Copy example environment file
cp .env.example .env.local

# Add your Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Seed Database (Option A - Direct)
```bash
# Seed database directly
npm run seed

# Or generate SQL file only
npm run seed:sql
```

### 4. Run Migration (Option B - SQL)
```bash
# Apply the sample data migration
supabase db push
```

### 5. Generate Data Files
```bash
# Generate all export formats
npm run generate:data

# View data statistics
npm run data:stats
```

## 📁 File Structure

```
src/utils/
├── sampleDataGenerator.ts    # Core data generation logic
├── mockData.ts              # Pre-generated sample data
├── dataExport.ts            # Export utilities
└── sampleData.ts            # Legacy sample data (deprecated)

scripts/
└── seed-database.ts         # Database seeding script

supabase/migrations/
└── 20250109000001_sample_data_seed.sql  # Sample data migration
```

## 🔧 Usage Examples

### In React Components
```typescript
import { mockData, mockApi } from '@/utils/mockData';

// Use pre-generated data
const projects = mockData.projects;
const projectsWithSites = mockData.projectsWithSites;

// Use mock API functions
const paginatedProjects = mockApi.getProjects(1, 10);
const projectDetails = mockApi.getProject('project-id');
```

### Generate Fresh Data
```typescript
import { sampleDataGenerator } from '@/utils/sampleDataGenerator';

// Generate new dataset
const freshData = sampleDataGenerator.generateCompleteDataset();

// Export as JSON
const jsonData = sampleDataGenerator.exportToJSON();

// Export as SQL
const sqlData = sampleDataGenerator.exportToSQL();
```

### Export Data
```typescript
import { dataExporter, exportUtils } from '@/utils/dataExport';

// Download JSON file
exportUtils.downloadJSON('my-data.json');

// Download SQL file
exportUtils.downloadSQL('my-data.sql');

// Download CSV for specific table
exportUtils.downloadCSV('projects', 'projects.csv');

// Generate all files
exportUtils.generateAll();
```

## 📈 Data Relationships

### Hierarchical Structure
```
Projects (100)
├── Exploration Sites (500)
    ├── Mineral Deposits (800)
        └── AI Predictions (1,200)

User Profiles (50)
└── Projects (owned/managed)
```

### Key Relationships
- **Projects → Sites**: 1:N (avg 5 sites per project)
- **Sites → Deposits**: 1:N (avg 1.6 deposits per site)
- **Deposits → Predictions**: 1:N (avg 1.5 predictions per deposit)
- **Users → Projects**: 1:N (projects assigned to users)

## 🎨 Data Visualization Ready

The sample data is optimized for all visualization components:

### Charts & Analytics
- **Project Metrics**: Budget utilization, timeline progress
- **Mineral Analysis**: Grade distribution, confidence levels
- **Geographic Mapping**: Coordinate-based visualizations
- **Trend Analysis**: Time-series data for progress tracking

### Interactive Maps
- **Mapbox Integration**: Proper coordinate formatting
- **Layer Support**: Projects, sites, deposits as separate layers
- **Clustering**: Realistic geographic clustering
- **Popup Data**: Rich metadata for map interactions

### Data Tables
- **Sorting**: All columns support realistic sorting
- **Filtering**: Meaningful filter options across all fields
- **Pagination**: Large datasets for pagination testing
- **Search**: Full-text search across relevant fields

## 🔍 Data Quality Assurance

### Validation Rules
- ✅ **Coordinate Validation**: All coordinates within valid ranges
- ✅ **Date Consistency**: Logical date sequences maintained
- ✅ **Grade Realism**: Mineral-specific grade ranges
- ✅ **Relationship Integrity**: All foreign keys valid
- ✅ **Enum Compliance**: All enum values match schema

### Testing Coverage
- ✅ **Unit Tests**: Data generation functions
- ✅ **Integration Tests**: Database seeding
- ✅ **Performance Tests**: Large dataset handling
- ✅ **Validation Tests**: Schema compliance

## 🌍 Geographic Regions

### Primary Mining Areas
1. **Nevada Gold Fields** (Elko County)
   - Carlin Trend gold deposits
   - 40.5°N, 116.5°W region

2. **Colorado Rockies** (Clear Creek County)
   - Historic silver mining district
   - 39.7°N, 105.5°W region

3. **Arizona Copper Belt** (Pinal County)
   - Porphyry copper deposits
   - 33.0°N, 111.0°W region

4. **Montana Platinum** (Stillwater County)
   - Stillwater Complex PGM deposits
   - 45.5°N, 109.5°W region

5. **Utah Minerals** (Beaver County)
   - Rare earth elements and lithium
   - 38.5°N, 112.5°W region

## 🤖 AI Model Details

### Model Types
- **DeepMine-v2.1**: CNN-based mineral classification
- **GeoNet-Pro**: Neural network for grade prediction
- **MineralAI-Advanced**: Random forest ensemble
- **GeoPredictive-3.0**: Gradient boosting model
- **TerraVision-ML**: Support vector machine
- **RockSense-AI**: Computer vision for core analysis
- **GeologicalGPT**: Transformer-based predictions
- **MineralClassifier-v4**: Multi-class classification

### Prediction Features
- **Geological Formation**: Rock type and structure
- **Geochemical Signatures**: Element concentrations
- **Geophysical Anomalies**: Magnetic and gravity data
- **Structural Features**: Faults and fractures
- **Alteration Zones**: Hydrothermal alteration
- **Spectral Analysis**: Hyperspectral imagery
- **Drill Core Data**: Physical core properties

## 📊 Export Formats

### JSON Export
```json
{
  "metadata": {
    "exportDate": "2024-01-09T12:00:00Z",
    "version": "1.0.0",
    "statistics": { ... }
  },
  "profiles": [...],
  "projects": [...],
  "sites": [...],
  "deposits": [...],
  "predictions": [...]
}
```

### SQL Export
```sql
-- Complete INSERT statements for all tables
INSERT INTO profiles (id, email, full_name, ...) VALUES (...);
INSERT INTO projects (id, name, description, ...) VALUES (...);
-- ... etc
```

### CSV Export
- Individual CSV files for each table
- Proper escaping for complex data types
- Headers included for easy import

## 🔧 Customization

### Modify Generation Parameters
```typescript
// Adjust record counts
const profiles = generator.generateProfiles(100);  // More profiles
const projects = generator.generateProjects(200);  // More projects

// Customize geographic regions
const customRegions = [
  { name: 'Custom Region', lat: 45.0, lng: -110.0, radius: 2.0 }
];

// Adjust mineral types
const customMinerals = ['Gold', 'Silver', 'Copper'];  // Subset only
```

### Add New Data Types
```typescript
// Extend the generator for new entities
class CustomDataGenerator extends SampleDataGenerator {
  generateCustomEntity(count: number) {
    // Your custom generation logic
  }
}
```

## 🚀 Performance Considerations

### Generation Speed
- **Full Dataset**: ~2-3 seconds for 2,650+ records
- **Memory Usage**: ~50MB for complete dataset
- **Database Seeding**: ~10-15 seconds depending on connection

### Optimization Tips
- Use pagination for large datasets
- Implement proper indexing on frequently queried fields
- Consider data caching for repeated access
- Use lazy loading for related data

## 🛠️ Troubleshooting

### Common Issues

#### Database Connection
```bash
# Check environment variables
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
npm run health
```

#### Data Generation Errors
```bash
# Clear and regenerate
npm run seed -- --clear-first

# Generate SQL file for manual inspection
npm run seed:sql
```

#### Missing Dependencies
```bash
# Install all required packages
npm install @faker-js/faker @tanstack/react-table dotenv tsx
```

## 📚 Additional Resources

### Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Faker.js Documentation](https://fakerjs.dev/)

### Related Files
- `src/integrations/supabase/enhanced-types.ts` - TypeScript definitions
- `src/hooks/useApiQuery.ts` - Data fetching hooks
- `src/components/forms/` - Form components using sample data
- `src/components/charts/` - Visualization components

---

## 🎉 Ready to Explore!

Your GeoVision AI Miner application now has comprehensive, realistic sample data covering all aspects of geological exploration. The data is designed to showcase every feature of your application while maintaining geological accuracy and industry relevance.

**Next Steps:**
1. Run `npm run seed` to populate your database
2. Start the development server with `npm run dev`
3. Explore the application with rich, realistic data
4. Use the export utilities to share or backup your data

Happy exploring! 🚀⛏️💎