# Domain Migration Guide

This document outlines the migration process from legacy domains to the new production domains:
- **Frontend**: `https://geo-miner.com` (+ `https://www.geo-miner.com`)
- **API**: `https://api.geo-miner.com`

## Overview

The migration involves updating DNS records, TLS certificates, environment configurations, and implementing redirects from legacy domains.

## Prerequisites

- [ ] DNS management access for `geo-miner.com` domain
- [ ] TLS certificate management (Let's Encrypt, AWS Certificate Manager, or similar)
- [ ] Access to hosting infrastructure (AWS, Netlify, etc.)
- [ ] Supabase project admin access
- [ ] GitHub repository admin access

## Migration Steps

### Phase 1: DNS and TLS Setup

#### 1.1 Create DNS Records

Create the following DNS records for `geo-miner.com`:

```dns
# Frontend (apex domain)
geo-miner.com.          A     <frontend-ip-address>
# OR
geo-miner.com.          ALIAS <frontend-load-balancer>

# Frontend (www subdomain) 
www.geo-miner.com.      CNAME geo-miner.com.

# API subdomain
api.geo-miner.com.      A     <api-ip-address>
# OR  
api.geo-miner.com.      CNAME <api-load-balancer>
```

#### 1.2 TLS Certificate Setup

**Option A: AWS Certificate Manager**
```bash
# Request certificate for all domains
aws acm request-certificate \
  --domain-name geo-miner.com \
  --subject-alternative-names www.geo-miner.com api.geo-miner.com \
  --validation-method DNS \
  --region us-east-1
```

**Option B: Let's Encrypt (Certbot)**
```bash
# Install certbot
sudo apt-get install certbot

# Request certificate
sudo certbot certonly --dns-route53 \
  -d geo-miner.com \
  -d www.geo-miner.com \
  -d api.geo-miner.com
```

**Option C: Cloudflare (if using Cloudflare)**
- Enable SSL/TLS in Cloudflare dashboard
- Set SSL/TLS encryption mode to "Full (strict)"
- Enable "Always Use HTTPS"

#### 1.3 Verify DNS Propagation

```bash
# Check DNS propagation
dig geo-miner.com
dig www.geo-miner.com  
dig api.geo-miner.com

# Check TLS certificates
openssl s_client -connect geo-miner.com:443 -servername geo-miner.com
openssl s_client -connect api.geo-miner.com:443 -servername api.geo-miner.com
```

### Phase 2: Staging Environment Setup

#### 2.1 Create Staging DNS Records (Optional)

```dns
staging.geo-miner.com.     CNAME <staging-frontend>
api.staging.geo-miner.com. CNAME <staging-api>
```

#### 2.2 Deploy to Staging

```bash
# Set staging environment variables
export VITE_SITE_URL=https://staging.geo-miner.com
export VITE_API_BASE_URL=https://api.staging.geo-miner.com
export BASE_URL=https://api.staging.geo-miner.com
export ALLOWED_ORIGINS=https://staging.geo-miner.com

# Deploy staging
./deploy-staging.sh
```

#### 2.3 Test Staging Environment

```bash
# Run E2E tests against staging
npm run test:e2e:staging

# Manual verification
curl https://api.staging.geo-miner.com/healthz
curl -I https://staging.geo-miner.com
```

### Phase 3: Production Deployment

#### 3.1 Update Environment Variables

**Frontend (.env.production)**
```bash
VITE_SITE_URL=https://geo-miner.com
VITE_API_BASE_URL=https://api.geo-miner.com
VITE_ENVIRONMENT=production
```

**Backend**
```bash
BASE_URL=https://api.geo-miner.com
ALLOWED_ORIGINS=https://geo-miner.com,https://www.geo-miner.com
```

#### 3.2 Update Supabase Configuration

1. **Login to Supabase Dashboard**
   - Go to your project settings
   - Navigate to Authentication > URL Configuration

2. **Add Redirect URLs**
   ```
   https://geo-miner.com/*
   https://www.geo-miner.com/*
   ```

3. **Update Site URL**
   ```
   Site URL: https://geo-miner.com
   ```

4. **Optional: CLI Method**
   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli
   
   # Login and link project
   supabase login
   supabase link --project-ref <your-project-ref>
   
   # Update auth config
   supabase settings update auth \
     --site-url https://geo-miner.com \
     --redirect-urls "https://geo-miner.com/*,https://www.geo-miner.com/*"
   ```

#### 3.3 Deploy Backend

```bash
# Deploy backend with new environment
cd backend
docker build -t geovision-api:latest .
docker tag geovision-api:latest <registry>/geovision-api:latest
docker push <registry>/geovision-api:latest

# Update deployment
kubectl set image deployment/geovision-api api=<registry>/geovision-api:latest
# OR
aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment
```

#### 3.4 Deploy Frontend

```bash
# Build with production environment
npm run build

# Deploy to hosting platform
# Netlify
netlify deploy --prod --dir=dist

# AWS S3 + CloudFront
aws s3 sync dist/ s3://<bucket-name>/
aws cloudfront create-invalidation --distribution-id <dist-id> --paths "/*"

# Vercel
vercel --prod
```

### Phase 4: Redirect Configuration

#### 4.1 Nginx Redirects (if using Nginx)

```nginx
# /etc/nginx/sites-available/geo-miner-redirects
server {
    listen 443 ssl http2;
    server_name www.geo-miner.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    return 301 https://geo-miner.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name geovision-ai-miner.com www.geovision-ai-miner.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    return 301 https://geo-miner.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sunny-pasca-eed8fc.netlify.app;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    return 301 https://geo-miner.com$request_uri;
}
```

#### 4.2 CloudFront Function Redirects (if using AWS)

```javascript
// cloudfront-redirects.js
function handler(event) {
    var request = event.request;
    var host = request.headers.host.value;
    
    // Redirect www to apex
    if (host === 'www.geo-miner.com') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: 'https://geo-miner.com' + request.uri }
            }
        };
    }
    
    // Redirect legacy domains
    if (host === 'geovision-ai-miner.com' || 
        host === 'www.geovision-ai-miner.com' ||
        host === 'sunny-pasca-eed8fc.netlify.app') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                'location': { value: 'https://geo-miner.com' + request.uri }
            }
        };
    }
    
    return request;
}
```

#### 4.3 Netlify Redirects

```toml
# netlify.toml
[[redirects]]
  from = "https://www.geo-miner.com/*"
  to = "https://geo-miner.com/:splat"
  status = 301
  force = true

[[redirects]]
  from = "https://sunny-pasca-eed8fc.netlify.app/*"
  to = "https://geo-miner.com/:splat"
  status = 301
  force = true
```

### Phase 5: Verification and Testing

#### 5.1 Automated Testing

```bash
# Run domain validation tests
npm run test:domain-validation

# Run E2E tests
npm run test:e2e:production

# Run backend tests
cd backend && python -m pytest tests/test_domain_config.py
```

#### 5.2 Manual Verification Checklist

- [ ] **Frontend Accessibility**
  - [ ] `https://geo-miner.com` loads correctly
  - [ ] `https://www.geo-miner.com` redirects to apex domain
  - [ ] Canonical URLs are correct
  - [ ] Meta tags reference correct domain

- [ ] **API Functionality**
  - [ ] `https://api.geo-miner.com/healthz` returns 200
  - [ ] OpenAPI docs show correct server URL
  - [ ] CORS allows frontend domain
  - [ ] STAC catalog links use correct base URL

- [ ] **Authentication Flow**
  - [ ] Login redirects to correct domain
  - [ ] Logout redirects to correct domain
  - [ ] Password reset emails use correct links

- [ ] **Redirects**
  - [ ] Legacy domains redirect to new domain
  - [ ] www subdomain redirects to apex
  - [ ] HTTP redirects to HTTPS

#### 5.3 Performance and Security

```bash
# Test performance
lighthouse https://geo-miner.com --output=json

# Test security headers
curl -I https://geo-miner.com
curl -I https://api.geo-miner.com

# Test SSL configuration
ssllabs-scan --host geo-miner.com
ssllabs-scan --host api.geo-miner.com
```

### Phase 6: Monitoring and Alerts

#### 6.1 Set Up Monitoring

```bash
# Add domain monitoring
# Pingdom, UptimeRobot, or similar
curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -d "api_key=<key>" \
  -d "friendly_name=GeoVision Frontend" \
  -d "url=https://geo-miner.com" \
  -d "type=1"

curl -X POST "https://api.uptimerobot.com/v2/newMonitor" \
  -d "api_key=<key>" \
  -d "friendly_name=GeoVision API" \
  -d "url=https://api.geo-miner.com/healthz" \
  -d "type=1"
```

#### 6.2 Update CI/CD Monitoring

```yaml
# .github/workflows/production-monitoring.yml
name: Production Health Check
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
    
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Frontend
        run: |
          curl -f https://geo-miner.com || exit 1
          
      - name: Check API
        run: |
          curl -f https://api.geo-miner.com/healthz || exit 1
          
      - name: Notify on Failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Rollback Plan

### Emergency Rollback Procedure

If issues are encountered during migration:

#### 1. DNS Rollback
```bash
# Revert DNS records to previous values
# Update A/CNAME records to point back to legacy infrastructure
```

#### 2. Environment Rollback
```bash
# Revert environment variables
export VITE_SITE_URL=https://sunny-pasca-eed8fc.netlify.app
export VITE_API_BASE_URL=https://your-legacy-api-domain.com
export BASE_URL=https://your-legacy-api-domain.com
export ALLOWED_ORIGINS=https://sunny-pasca-eed8fc.netlify.app

# Redeploy with legacy configuration
./deploy-rollback.sh
```

#### 3. Supabase Rollback
```bash
# Revert Supabase redirect URLs
supabase settings update auth \
  --site-url https://sunny-pasca-eed8fc.netlify.app \
  --redirect-urls "https://sunny-pasca-eed8fc.netlify.app/*"
```

#### 4. Disable Redirects
```bash
# Comment out or disable redirect rules
# Nginx: comment out redirect server blocks
# CloudFront: disable function association
# Netlify: comment out redirect rules in netlify.toml
```

### Rollback Testing

```bash
# Test rollback environment
npm run test:e2e:rollback

# Verify legacy domains work
curl https://sunny-pasca-eed8fc.netlify.app
curl https://your-legacy-api-domain.com/healthz
```

## Post-Migration Tasks

### 1. Update Documentation
- [ ] Update README.md with new URLs
- [ ] Update API documentation
- [ ] Update deployment guides
- [ ] Update monitoring dashboards

### 2. Communication
- [ ] Notify team of successful migration
- [ ] Update external documentation/wikis
- [ ] Update any hardcoded references in external systems

### 3. Cleanup (After 30 days)
- [ ] Remove legacy environment configurations
- [ ] Clean up old DNS records (if safe)
- [ ] Remove legacy domain monitoring
- [ ] Archive old deployment configurations

## Troubleshooting

### Common Issues

#### DNS Propagation Delays
```bash
# Check propagation status
dig @8.8.8.8 geo-miner.com
dig @1.1.1.1 geo-miner.com

# Force DNS refresh (varies by OS)
sudo systemctl flush-dns  # Linux
sudo dscacheutil -flushcache  # macOS
```

#### TLS Certificate Issues
```bash
# Check certificate validity
openssl s_client -connect geo-miner.com:443 -servername geo-miner.com

# Renew Let's Encrypt certificate
sudo certbot renew --dry-run
```

#### CORS Issues
```bash
# Test CORS from browser console
fetch('https://api.geo-miner.com/healthz', {
  method: 'GET',
  headers: { 'Origin': 'https://geo-miner.com' }
})
```

#### Supabase Auth Issues
- Check redirect URLs in Supabase dashboard
- Verify Site URL matches frontend domain
- Clear browser cache and cookies
- Test in incognito/private browsing mode

### Support Contacts

- **DNS Issues**: Contact domain registrar support
- **TLS Issues**: Contact certificate provider support  
- **Hosting Issues**: Contact hosting provider support
- **Supabase Issues**: Check Supabase status page and documentation

## Success Criteria

The migration is considered successful when:

- [ ] All automated tests pass
- [ ] Frontend loads correctly on new domain
- [ ] API responds correctly on new domain
- [ ] Authentication flow works end-to-end
- [ ] Redirects from legacy domains work
- [ ] No increase in error rates or performance degradation
- [ ] Monitoring shows healthy status for 24+ hours

## Timeline

**Recommended migration timeline:**

- **Week 1**: DNS and TLS setup, staging deployment
- **Week 2**: Production deployment, redirect configuration
- **Week 3**: Monitoring and optimization
- **Week 4**: Documentation and cleanup

**Maintenance window**: Plan for 2-4 hour maintenance window during low-traffic period for production cutover.