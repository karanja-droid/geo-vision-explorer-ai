# Implementation Plan

## Task Overview

This implementation plan breaks down the 10 enterprise features into manageable, incremental tasks that build upon each other. Each task includes database migrations, API endpoints, Celery tasks, frontend components, and comprehensive tests.

## Implementation Tasks

### Phase 1: Foundation & Infrastructure

- [ ] 1.1 Set up Celery infrastructure and Redis configuration
  - Configure Celery with Redis broker
  - Create base task classes and error handling
  - Set up monitoring and logging for background tasks
  - Add environment variables for Celery configuration
  - _Requirements: Cross-cutting infrastructure_

- [ ] 1.2 Create base database schema with RLS foundation
  - Add org_id, project_id, data_classification columns to existing tables
  - Create organizations and projects tables if missing
  - Set up base RLS policies for multi-tenancy
  - Create migration scripts for schema updates
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 1.3 Implement feature flags system
  - Create feature flag configuration system
  - Add environment-driven feature toggles
  - Implement graceful degradation for disabled features
  - Create admin interface for feature flag management
  - _Requirements: Cross-cutting feature flags_

### Phase 2: Feature Store Service (Deliverable 1)

- [ ] 2.1 Create feature store database schema and migrations
  - Implement fs_cells table with PostGIS geometry column
  - Implement fs_features table with proper indexing
  - Create GIST spatial index on geometry column
  - Add constraints and foreign key relationships
  - _Requirements: 1.1, 1.2_

- [ ] 2.2 Implement multi-scale feature computation Celery task
  - Create FeatureComputationTask with distance calculations
  - Implement statistical feature extraction (mag/gravity/spectral)
  - Add morphometry and geology one-hot encoding
  - Support multiple scales (1km, 3km, 5km) processing
  - _Requirements: 1.3, 1.4_

- [ ] 2.3 Build feature store API endpoints
  - Implement GET /features endpoint with bbox/keys/scales filtering
  - Add parquet and CSV response format support
  - Implement summary statistics calculation
  - Add Redis caching with parameter-based key hashing
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 2.4 Create S3 parquet export functionality
  - Implement automated parquet export to S3
  - Document S3 path structure and naming conventions
  - Add export status tracking and notifications
  - Create cleanup policies for old exports
  - _Requirements: 1.5_

- [ ] 2.5 Add feature store tests and validation
  - Unit tests for feature computation algorithms
  - Integration tests for API endpoints
  - Performance tests for 60-second response requirement
  - Migration tests for schema creation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

### Phase 3: AI Inference & Uncertainty (Deliverable 2)

- [ ] 3.1 Implement dual COG output for AI inference
  - Modify inference pipeline to generate prospectivity.tif
  - Add uncertainty.tif generation with proper metadata
  - Create JSON sidecar files with color ramps and quantile breaks
  - Implement proper file naming and organization
  - _Requirements: 2.1, 2.2_

- [ ] 3.2 Update STAC catalog integration
  - Add both COG assets to STAC items with roles ["data"]
  - Include model_id, inference_date, aoi_bbox in metadata
  - Validate STAC compliance for dual-asset items
  - Update catalog browsing to handle uncertainty assets
  - _Requirements: 2.2_

- [ ] 3.3 Build uncertainty visualization frontend
  - Create uncertainty layer toggle component
  - Implement synchronized opacity slider for both layers
  - Add legend component with color ramps
  - Create PNG export functionality with legends
  - _Requirements: 2.3, 2.4, 2.5_

- [ ] 3.4 Add inference tests and validation
  - Test dual COG generation and file structure
  - Validate STAC item compliance
  - Test frontend layer toggling and synchronization
  - Integration tests for complete inference workflow
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

### Phase 4: Active Learning System (Deliverable 3)

- [ ] 4.1 Create labeling database schema
  - Design labels table with geometry, source, weight columns
  - Add model_versions table for tracking training iterations
  - Create metrics table for before/after performance tracking
  - Implement proper indexing for spatial queries
  - _Requirements: 3.2, 3.4_

- [ ] 4.2 Build interactive labeling UI
  - Create brush and point labeling tools
  - Implement high-uncertainty zone highlighting
  - Add positive/negative label assignment interface
  - Create label review and editing capabilities
  - _Requirements: 3.1_

- [ ] 4.3 Implement model retraining Celery task
  - Create RetrainModelTask with lightweight head fine-tuning
  - Implement model versioning and persistence
  - Add rollback capability to previous versions
  - Generate before/after metrics (AUC/PR, calibration)
  - _Requirements: 3.3, 3.4_

- [ ] 4.4 Build model management interface
  - Create model version selection UI
  - Implement before/after metrics display
  - Add model rollback functionality
  - Create model performance comparison charts
  - _Requirements: 3.4_

- [ ] 4.5 Add active learning tests
  - Test label persistence and retrieval
  - Validate retraining task execution
  - Test model versioning and rollback
  - Integration tests for 20+ label threshold
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

### Phase 5: Drill Data Management (Deliverable 4)

- [x] 5.1 Create drill hole database schema
  - Implement drill_collars table with PostGIS geometry
  - Create drill_surveys, drill_intervals, drill_assays tables
  - Add proper constraints for interval validation
  - Create indexes for hole_id and spatial queries
  - _Requirements: 4.1, 4.2_

- [x] 5.2 Implement data validation and QA engine
  - Create QA rules for duplicate detection
  - Implement interval overlap detection
  - Add missing CRS and extreme outlier detection
  - Create unit normalization for assay values
  - _Requirements: 4.2, 4.3_

- [x] 5.3 Build nightly QA report generation
  - Create QAReportTask for automated report generation
  - Implement HTML and PDF report templates
  - Add email notifications for QA issues
  - Create report archival and retrieval system
  - _Requirements: 4.3, 4.4_

- [x] 5.4 Create drill data upload interface
  - Build CSV/XLSX upload component
  - Implement data preview and validation
  - Add QA summary display
  - Create downloadable report links
  - _Requirements: 4.4, 4.5_

- [x] 5.5 Add drill data tests
  - Test constraint validation and overlap detection
  - Validate QA rule execution
  - Test report generation and formatting
  - Integration tests for upload workflow
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

### Phase 6: LIMS Integration (Deliverable 5)

- [ ] 6.1 Create LIMS database schema
  - Implement coc_batches and coc_items tables
  - Create qc_rules and qc_results tables
  - Add proper relationships and constraints
  - Create indexes for batch and sample queries
  - _Requirements: 5.1_

- [ ] 6.2 Implement QC statistical analysis
  - Create Levey-Jennings chart computation
  - Implement z-score calculation and breach detection
  - Add standard/blank/duplicate analysis
  - Create QC trend analysis algorithms
  - _Requirements: 5.2_

- [ ] 6.3 Build LIMS import and processing
  - Create CSV import functionality
  - Implement batch processing workflow
  - Add chain-of-custody status tracking
  - Create QC rule evaluation engine
  - _Requirements: 5.1, 5.2_

- [ ] 6.4 Create QC visualization interface
  - Build chain-of-custody table component
  - Implement Levey-Jennings chart display
  - Add QC breach flagging and alerts
  - Create PDF export for QC summaries
  - _Requirements: 5.3, 5.4, 5.5_

- [ ] 6.5 Add LIMS tests
  - Test QC rule evaluation and statistics
  - Validate Levey-Jennings plot generation
  - Test batch import and processing
  - Integration tests for complete QC workflow
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

### Phase 7: Security & Access Control (Deliverable 6)

- [ ] 7.1 Implement comprehensive RLS policies
  - Create organization-scoped access policies
  - Implement project membership write restrictions
  - Add data classification-based access control
  - Create country-based geographic restrictions
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 7.2 Create ABAC policy engine
  - Implement attribute-based access control
  - Add role-based permission matrix
  - Create dynamic policy evaluation
  - Add policy audit and logging
  - _Requirements: 6.3, 6.4_

- [ ] 7.3 Build comprehensive security tests
  - Create test matrix for all role combinations
  - Test organization and project isolation
  - Validate data classification restrictions
  - Test external user access limitations
  - _Requirements: 6.4, 6.5_

- [ ] 7.4 Add security monitoring and alerts
  - Implement access attempt logging
  - Create suspicious activity detection
  - Add real-time security alerts
  - Create security dashboard for administrators
  - _Requirements: 6.4_

### Phase 8: Data Residency & Encryption (Deliverable 7)

- [ ] 8.1 Implement regional data storage
  - Create region-specific S3 bucket configuration
  - Implement automatic bucket selection by org region
  - Add data migration tools for region changes
  - Create region compliance validation
  - _Requirements: 7.1, 7.2_

- [ ] 8.2 Add customer-managed key encryption
  - Implement CMK integration with AWS KMS
  - Add per-organization key management
  - Create key rotation functionality
  - Add encryption status monitoring
  - _Requirements: 7.1, 7.3_

- [ ] 8.3 Build enterprise admin interface
  - Create region and KMS configuration UI
  - Add key rotation management interface
  - Implement compliance status dashboard
  - Create data residency reporting
  - _Requirements: 7.3, 7.4_

- [ ] 8.4 Add data residency tests
  - Test region-specific storage placement
  - Validate CMK encryption in object metadata
  - Test key rotation functionality
  - Integration tests for enterprise configuration
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

### Phase 9: Audit & Compliance (Deliverable 8)

- [ ] 9.1 Create immutable audit log system
  - Implement append-only audit_log table
  - Create audit event capture middleware
  - Add hash chain computation for tamper evidence
  - Implement automatic log rotation
  - _Requirements: 8.1, 8.2_

- [ ] 9.2 Build WORM storage export system
  - Create scheduled S3 export with Object Lock
  - Implement compliance mode retention policies
  - Add lifecycle management for long-term retention
  - Create export batch tracking
  - _Requirements: 8.1, 8.3_

- [ ] 9.3 Implement audit verification system
  - Create hash chain verification algorithms
  - Add tamper detection and alerting
  - Implement audit trail reconstruction
  - Create compliance reporting tools
  - _Requirements: 8.4, 8.5_

- [ ] 9.4 Build audit management interface
  - Create audit log viewer with filtering
  - Add export status and retention display
  - Implement hash integrity verification UI
  - Create compliance dashboard
  - _Requirements: 8.4, 8.5_

- [ ] 9.5 Add audit system tests
  - Test append-only log functionality
  - Validate Object Lock and retention policies
  - Test hash chain verification
  - Integration tests for complete audit workflow
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

### Phase 10: Map Provider Flexibility (Deliverable 9)

- [ ] 10.1 Implement MapLibre GL integration
  - Add MapLibre GL as primary map provider
  - Create runtime provider switching logic
  - Implement feature parity with Mapbox GL
  - Add graceful fallback mechanisms
  - _Requirements: 9.1, 9.4_

- [ ] 10.2 Create tiles catalog system
  - Build /tiles/catalog.json endpoint
  - List all available MVT/COG endpoints
  - Add min/max zoom and field metadata
  - Include style hints and layer configuration
  - _Requirements: 9.2_

- [ ] 10.3 Ensure vendor-agnostic functionality
  - Validate all public demo layers work without keys
  - Create keyless mode for public demonstrations
  - Maintain enterprise Mapbox features when available
  - Add seamless provider transition
  - _Requirements: 9.3, 9.4, 9.5_

- [ ] 10.4 Add mapping tests
  - Test MapLibre GL functionality without vendor keys
  - Validate tiles catalog JSON structure
  - Test provider switching and fallback
  - Integration tests for public demo mode
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

### Phase 11: Usage & Billing (Deliverable 10)

- [ ] 11.1 Create usage tracking system
  - Add trial_ends_at to users/orgs tables
  - Implement usage_counters for AI runs, tiles, storage
  - Create real-time usage monitoring
  - Add usage aggregation and reporting
  - _Requirements: 10.1, 10.4_

- [ ] 11.2 Implement trial enforcement middleware
  - Create post-trial write operation blocking
  - Add read-only mode enforcement
  - Implement UI banner for trial status
  - Create conversion call-to-action flows
  - _Requirements: 10.1, 10.2_

- [ ] 11.3 Build credits and billing system
  - Create configurable quota system per plan
  - Implement credit deduction for AI runs
  - Add overage monitoring and alerts
  - Create low-balance email notifications
  - _Requirements: 10.3, 10.4_

- [ ] 11.4 Add billing integration hooks
  - Create webhook endpoints for billing reconciliation
  - Implement usage export for billing systems
  - Add payment status synchronization
  - Create billing dashboard for administrators
  - _Requirements: 10.5_

- [ ] 11.5 Add usage and billing tests
  - Test trial expiration and read-only enforcement
  - Validate credit deduction on AI runs
  - Test usage tracking accuracy
  - Integration tests for billing webhook flows
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

### Phase 12: Documentation & Deployment

- [ ] 12.1 Create comprehensive API documentation
  - Generate OpenAPI specifications for all new endpoints
  - Add code examples and integration guides
  - Create developer documentation for each feature
  - Add troubleshooting and FAQ sections
  - _Requirements: Cross-cutting documentation_

- [ ] 12.2 Update deployment and CI/CD
  - Add GitHub Actions for automated testing
  - Create migration validation workflows
  - Add data-ingest/tiles job summary artifacts
  - Update deployment scripts for new services
  - _Requirements: Cross-cutting CI/CD_

- [ ] 12.3 Create configuration management
  - Document all new environment variables
  - Create configuration templates for different environments
  - Add configuration validation and health checks
  - Create deployment checklists
  - _Requirements: Cross-cutting configuration_

- [ ] 12.4 Final integration testing
  - Run complete end-to-end test suite
  - Validate all feature flag combinations
  - Test cross-feature interactions
  - Performance testing under load
  - _Requirements: All deliverables_