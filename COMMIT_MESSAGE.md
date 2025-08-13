feat(domains): adopt geo-miner.com + api.geo-miner.com across app & API

## Summary
Complete domain migration implementation to adopt new production domains:
- Frontend: https://geo-miner.com (+ https://www.geo-miner.com)
- API: https://api.geo-miner.com
- Staging: https://staging.geo-miner.com + https://api.staging.geo-miner.com

## Frontend Changes
- Add environment configuration with runtime validation (src/config/env.ts)
- Create comprehensive API client with environment-based URLs (src/lib/api-client.ts)
- Implement SEO management with dynamic canonical URLs (src/lib/seo.ts)
- Add production/staging environment files (.env.production, .env.staging)
- Update build process to generate sitemap with correct domain

## Backend Changes
- Update settings to use BASE_URL and ALLOWED_ORIGINS (backend/app/core/config.py)
- Configure CORS middleware with new domain restrictions (backend/app/main.py)
- Add custom OpenAPI schema with correct server URLs
- Update STAC server to use BASE_URL environment variable
- Add baseUrl to health endpoint responses

## Quality Assurance
- Add CI/CD workflow for domain configuration validation (.github/workflows/domain-validation.yml)
- Create comprehensive E2E tests for domain functionality (tests/e2e/domain-validation.spec.ts)
- Add backend tests for configuration validation (backend/tests/test_domain_config.py)
- Implement automated checks for legacy domain references

## Infrastructure
- Configure Netlify redirects from legacy domains (netlify.toml)
- Update Content Security Policy to allow new API domains
- Add dynamic robots.txt and sitemap generation (scripts/generate-sitemap.js)
- Create Playwright configuration for E2E testing

## Documentation
- Complete migration guide with DNS/TLS setup (docs/MIGRATION.md)
- Supabase authentication redirect configuration (docs/SUPABASE_REDIRECTS.md)
- Implementation summary with rollback procedures (DOMAIN_MIGRATION_SUMMARY.md)
- Update README with new production URLs

## Security & Performance
- Implement runtime environment variable validation
- Restrict CORS to specific domains (no wildcards in production)
- Add proper CSP configuration for API domain connections
- Include comprehensive error handling and validation

## Testing
- Domain configuration validation tests
- API integration and CORS testing
- SEO meta tag and canonical URL validation
- Redirect functionality testing
- Security headers validation

## Breaking Changes
- Environment variables VITE_SITE_URL and VITE_API_BASE_URL are now required
- Backend requires BASE_URL and ALLOWED_ORIGINS configuration
- Legacy domain references will cause build failures

## Migration Notes
- DNS records need to be configured for geo-miner.com
- TLS certificates required for all new domains
- Supabase redirect URLs must be updated
- Staging environment should be tested before production deployment

Closes: Domain migration requirements
Implements: Production domain adoption with comprehensive validation