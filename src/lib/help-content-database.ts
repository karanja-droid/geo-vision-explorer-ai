import { HelpContent } from './contextual-help';

export const helpContentDatabase: HelpContent[] = [
  // Geological Site Management
  {
    id: 'geological-site-creation',
    title: 'Creating a Geological Site',
    content: `Learn how to create and configure geological sites with proper coordinates, mineral data, and analysis parameters. 

Key steps:
1. Navigate to Sites → New Site
2. Enter site coordinates (latitude/longitude or UTM)
3. Add geological formation details
4. Configure mineral analysis parameters
5. Set up sampling protocols
6. Save and begin data collection

Tips: Use high-precision GPS coordinates for accurate mapping. Consider local geological surveys for formation data.`,
    type: 'modal',
    category: 'geological',
    triggers: [
      { type: 'route', route: '/sites/new' },
      { type: 'element', selector: '[data-help="create-site"]' },
      { type: 'action', action: 'create_site' }
    ],
    priority: 10,
    tags: ['sites', 'geological', 'creation', 'coordinates', 'minerals'],
    searchKeywords: ['site', 'geological', 'create', 'new', 'location', 'coordinates', 'gps', 'formation'],
    relatedContent: ['mineral-deposit-analysis', 'site-management', 'gps-coordinates'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // AI Mineral Analysis
  {
    id: 'ai-mineral-analysis',
    title: 'AI Mineral Analysis & Prediction',
    content: `Understand how our AI analyzes mineral deposits, confidence scores, and prediction accuracy.

Our AI system uses:
- Satellite imagery analysis
- Geological formation patterns
- Historical mining data
- Spectral analysis results
- Machine learning models trained on global datasets

Confidence scores indicate:
- 90-100%: High confidence, recommended for detailed exploration
- 70-89%: Moderate confidence, suitable for preliminary surveys
- 50-69%: Low confidence, requires additional data
- Below 50%: Insufficient data for reliable prediction

The system continuously learns from new data to improve accuracy.`,
    type: 'sidebar',
    category: 'analysis',
    triggers: [
      { type: 'route', route: '/analytics' },
      { type: 'action', action: 'start_analysis' },
      { type: 'element', selector: '[data-help="ai-analysis"]' }
    ],
    priority: 9,
    tags: ['ai', 'analysis', 'minerals', 'prediction', 'confidence', 'machine-learning'],
    searchKeywords: ['ai', 'analysis', 'mineral', 'prediction', 'confidence', 'accuracy', 'machine learning', 'spectral'],
    relatedContent: ['geological-site-creation', 'data-interpretation', 'spectral-analysis'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Map Navigation
  {
    id: 'map-navigation',
    title: 'Interactive 3D Map Navigation',
    content: `Master the 3D map controls, layer management, and geological visualization features.

Navigation controls:
- Left click + drag: Rotate the map
- Right click + drag: Pan the map
- Scroll wheel: Zoom in/out
- Ctrl + scroll: Tilt the map
- Double-click: Zoom to location

Layer management:
- Toggle satellite imagery
- Show/hide geological formations
- Display mineral deposit markers
- Overlay drilling data
- View topographic contours

Advanced features:
- 3D terrain visualization
- Time-series data animation
- Custom marker creation
- Measurement tools
- Export map views`,
    type: 'tooltip',
    category: 'ui',
    triggers: [
      { type: 'element', selector: '.mapbox-gl-canvas' },
      { type: 'route', route: '/dashboard' },
      { type: 'action', action: 'map_interaction' }
    ],
    priority: 8,
    tags: ['map', 'navigation', '3d', 'visualization', 'layers', 'controls'],
    searchKeywords: ['map', 'navigation', '3d', 'zoom', 'layers', 'satellite', 'terrain', 'controls'],
    relatedContent: ['geological-site-creation', 'data-visualization', 'satellite-imagery'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Team Collaboration
  {
    id: 'collaboration-features',
    title: 'Team Collaboration & Project Sharing',
    content: `Collaborate with your team using real-time sharing, comments, and project management features.

Collaboration features:
- Real-time project sharing
- Live cursor tracking
- Comment and annotation system
- Version control for geological data
- Team member permissions
- Activity notifications

Project management:
- Create shared workspaces
- Assign tasks and responsibilities
- Track project progress
- Share analysis results
- Export collaborative reports

Communication tools:
- In-app messaging
- Comment threads on sites
- @mention team members
- Email notifications
- Mobile app sync`,
    type: 'inline',
    category: 'collaboration',
    triggers: [
      { type: 'route', route: '/collaboration' },
      { type: 'action', action: 'invite_user' },
      { type: 'element', selector: '[data-help="collaboration"]' }
    ],
    priority: 7,
    tags: ['collaboration', 'team', 'sharing', 'projects', 'communication'],
    searchKeywords: ['collaborate', 'team', 'share', 'invite', 'project', 'workspace', 'comments'],
    relatedContent: ['project-management', 'user-permissions', 'notifications'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Spectral Analysis
  {
    id: 'spectral-analysis',
    title: 'Spectral Analysis & Remote Sensing',
    content: `Learn how to interpret spectral analysis data and remote sensing imagery for mineral identification.

Spectral analysis basics:
- Different minerals reflect light differently
- Spectral signatures help identify mineral types
- Hyperspectral imaging provides detailed analysis
- Machine learning enhances interpretation

Key spectral bands:
- Visible (400-700nm): Basic mineral identification
- Near-infrared (700-1400nm): Clay minerals, vegetation
- Short-wave infrared (1400-3000nm): Hydroxyl-bearing minerals
- Thermal infrared (8000-14000nm): Silicate minerals

Interpretation tips:
- Compare with reference spectra
- Consider atmospheric corrections
- Account for surface conditions
- Validate with ground truth data`,
    type: 'modal',
    category: 'analysis',
    triggers: [
      { type: 'action', action: 'spectral_analysis' },
      { type: 'element', selector: '[data-help="spectral"]' }
    ],
    priority: 8,
    tags: ['spectral', 'analysis', 'remote-sensing', 'minerals', 'hyperspectral'],
    searchKeywords: ['spectral', 'analysis', 'remote', 'sensing', 'hyperspectral', 'bands', 'signature'],
    relatedContent: ['ai-mineral-analysis', 'satellite-imagery', 'mineral-identification'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Drilling Data Management
  {
    id: 'drilling-data-management',
    title: 'Drilling Data & Core Sample Analysis',
    content: `Manage drilling operations, core samples, and geological logging data effectively.

Drilling data types:
- Drill hole locations and orientations
- Core sample intervals
- Geological logging data
- Assay results
- Geotechnical measurements

Data entry best practices:
- Use standardized geological codes
- Maintain consistent depth measurements
- Record sample chain of custody
- Include quality control samples
- Document drilling conditions

Analysis features:
- 3D drill hole visualization
- Cross-section generation
- Grade interpolation
- Resource estimation
- Statistical analysis`,
    type: 'sidebar',
    category: 'geological',
    triggers: [
      { type: 'action', action: 'drilling_data' },
      { type: 'element', selector: '[data-help="drilling"]' }
    ],
    priority: 7,
    tags: ['drilling', 'core-samples', 'logging', 'assay', 'geotechnical'],
    searchKeywords: ['drilling', 'core', 'samples', 'logging', 'assay', 'holes', 'geological'],
    relatedContent: ['geological-site-creation', 'data-visualization', 'quality-control'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Data Export & Reporting
  {
    id: 'data-export-reporting',
    title: 'Data Export & Report Generation',
    content: `Export your geological data and generate professional reports for stakeholders.

Export formats:
- CSV/Excel for tabular data
- Shapefile/GeoJSON for GIS
- PDF reports with maps and charts
- 3D models (OBJ, PLY formats)
- Industry-standard formats (COLLAR, SURVEY, ASSAY)

Report types:
- Executive summaries
- Technical geological reports
- Exploration progress reports
- Resource estimation reports
- Environmental impact assessments

Customization options:
- Company branding
- Custom templates
- Automated scheduling
- Multi-language support
- Digital signatures`,
    type: 'modal',
    category: 'general',
    triggers: [
      { type: 'action', action: 'export_data' },
      { type: 'element', selector: '[data-help="export"]' }
    ],
    priority: 6,
    tags: ['export', 'reporting', 'pdf', 'data', 'formats'],
    searchKeywords: ['export', 'report', 'pdf', 'csv', 'shapefile', 'data', 'download'],
    relatedContent: ['data-visualization', 'project-management', 'collaboration-features'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Security & Permissions
  {
    id: 'security-permissions',
    title: 'Security Settings & User Permissions',
    content: `Manage user access, data security, and permission levels for your geological projects.

User roles:
- Administrator: Full system access
- Geologist: Project and site management
- Geophysicist: Advanced analysis tools
- Drilling Manager: Drilling operations
- QA/QC Specialist: Quality control
- Environmental Officer: Environmental compliance
- Executive: Reporting and dashboards

Security features:
- Multi-factor authentication
- Data encryption at rest and in transit
- Audit logging
- IP address restrictions
- Session management
- Regular security updates

Permission levels:
- View: Read-only access
- Edit: Modify data and settings
- Admin: Full control including user management
- Custom: Granular permission control`,
    type: 'sidebar',
    category: 'general',
    triggers: [
      { type: 'route', route: '/security' },
      { type: 'action', action: 'security_settings' }
    ],
    priority: 6,
    tags: ['security', 'permissions', 'users', 'roles', 'authentication'],
    searchKeywords: ['security', 'permissions', 'users', 'roles', 'access', 'authentication', 'mfa'],
    relatedContent: ['collaboration-features', 'user-management', 'audit-logging'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Mobile App Usage
  {
    id: 'mobile-app-usage',
    title: 'Mobile App for Field Work',
    content: `Use the GeoVision mobile app for field data collection and offline access.

Field data collection:
- GPS location recording
- Photo documentation with geotagging
- Sample collection logging
- Field notes and observations
- Offline data storage
- Sync when connected

Mobile features:
- Offline map access
- Camera integration
- GPS tracking
- Voice notes
- Barcode scanning for samples
- Weather data integration

Best practices:
- Download maps before field work
- Regularly sync data
- Use external GPS for precision
- Backup important data
- Charge devices and bring power banks`,
    type: 'modal',
    category: 'general',
    triggers: [
      { type: 'action', action: 'mobile_app' },
      { type: 'element', selector: '[data-help="mobile"]' }
    ],
    priority: 5,
    tags: ['mobile', 'field-work', 'offline', 'gps', 'data-collection'],
    searchKeywords: ['mobile', 'app', 'field', 'offline', 'gps', 'photos', 'samples'],
    relatedContent: ['geological-site-creation', 'data-export-reporting', 'gps-coordinates'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  },

  // Troubleshooting
  {
    id: 'troubleshooting-common-issues',
    title: 'Troubleshooting Common Issues',
    content: `Solutions for common problems and technical issues you might encounter.

Map not loading:
- Check internet connection
- Clear browser cache
- Disable ad blockers
- Try different browser
- Contact support if persistent

Data upload issues:
- Verify file format compatibility
- Check file size limits (max 100MB)
- Ensure proper column headers
- Validate coordinate formats
- Remove special characters

Analysis not working:
- Verify sufficient data points
- Check coordinate system
- Ensure data quality
- Wait for processing to complete
- Refresh the page

Performance issues:
- Close unnecessary browser tabs
- Update to latest browser version
- Check system requirements
- Clear application cache
- Restart the application`,
    type: 'modal',
    category: 'general',
    triggers: [
      { type: 'error', errorCode: 'map_load_error' },
      { type: 'error', errorCode: 'upload_error' },
      { type: 'action', action: 'troubleshooting' }
    ],
    priority: 9,
    tags: ['troubleshooting', 'issues', 'problems', 'errors', 'support'],
    searchKeywords: ['troubleshooting', 'problems', 'issues', 'errors', 'not working', 'help', 'fix'],
    relatedContent: ['technical-support', 'system-requirements', 'browser-compatibility'],
    lastUpdated: new Date(),
    analytics: {
      views: 0,
      interactions: 0,
      completions: 0,
      dismissals: 0,
      helpfulness: 0,
      searchRank: 0
    }
  }
];

// Function to initialize help content in the system
export function initializeHelpContent() {
  import('./contextual-help').then(({ helpManager }) => {
    helpContentDatabase.forEach(content => {
      helpManager.registerContent(content);
    });
  });
}

// Function to get help content by category
export function getHelpContentByCategory(category: string): HelpContent[] {
  return helpContentDatabase.filter(content => content.category === category);
}

// Function to get help content by tags
export function getHelpContentByTags(tags: string[]): HelpContent[] {
  return helpContentDatabase.filter(content => 
    tags.some(tag => content.tags.includes(tag))
  );
}

// Function to get most popular help content
export function getPopularHelpContent(limit: number = 5): HelpContent[] {
  return helpContentDatabase
    .sort((a, b) => b.analytics.views - a.analytics.views)
    .slice(0, limit);
}