# Role-Based Data Entry & Reports Implementation

## Overview
Implementing comprehensive role-based data entry and reporting system for 8 specialized mining roles with full export capabilities, Adobe PDF viewing, and STAC metadata management.

## Implementation Plan

### Phase 1: Core Infrastructure
1. Database migrations for role-specific tables
2. Export system with Celery jobs
3. Adobe PDF viewer integration
4. STAC metadata registration

### Phase 2: Role Modules (Priority Order)
1. **EXECUTIVES** - Budget approvals, ESG sign-offs, KPI dashboards
2. **GEOLOGISTS** - Field mapping, drill logs, target annotations
3. **DRILLERS** - Drill plans, progress tracking, cost analysis
4. **GEOCHEMISTS/LIMS** - Sample registration, QA/QC, assay management
5. **GEOPHYSICISTS/RS** - Survey specs, anomaly mapping, processing chains
6. **SURVEYORS** - Collar pickups, control points, DTM updates
7. **PLANNERS** - Scenario modeling, scheduling, resource planning
8. **INVESTORS** - View-only quarterly reports and resource snapshots

### Phase 3: Integration & Testing
1. Role-based access controls (RLS/ABAC)
2. Export format validation
3. Performance optimization
4. End-to-end testing

## Technical Architecture

### Database Schema
- Cross-cutting fields: org_id, project_id, country_code, data_classification
- Provenance: source, license, collected_at, created_at, updated_at
- RLS policies for all tables

### Export System
- Async Celery jobs for large exports
- S3 signed URLs for file delivery
- Multiple format support per role
- STAC metadata for all artifacts

### Validation
- Server-side validation for all inputs
- Geometry/CRS validation (SRID=4326)
- Business rule enforcement
- Data quality scoring

## Feature Flags
- FEATURE_REPORTS_EXEC
- FEATURE_REPORTS_GEO
- FEATURE_REPORTS_RS
- FEATURE_REPORTS_GCHEM
- FEATURE_REPORTS_DRILL
- FEATURE_REPORTS_SURVEY
- FEATURE_REPORTS_PLAN
- FEATURE_ADOBE_VIEW

## Environment Variables
### Frontend
- VITE_ADOBE_CLIENT_ID
- VITE_SITE_URL
- VITE_API_BASE_URL

### Backend
- ADOBE_CLIENT_ID
- BASE_URL
- ALLOWED_ORIGINS