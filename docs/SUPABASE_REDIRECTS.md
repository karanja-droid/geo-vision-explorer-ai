# Supabase Authentication Redirect Configuration

This document provides step-by-step instructions for configuring Supabase authentication redirects for the new `geo-miner.com` domain.

## Overview

Supabase requires explicit configuration of allowed redirect URLs for authentication flows. This ensures security by preventing unauthorized redirects during login/logout processes.

## Required Redirect URLs

For the new domain structure, configure these redirect URLs:

### Production
- `https://geo-miner.com/*`
- `https://www.geo-miner.com/*`

### Staging (if applicable)
- `https://staging.geo-miner.com/*`

### Development (keep existing)
- `http://localhost:8080/*`
- `http://localhost:3000/*`

## Configuration Methods

### Method 1: Supabase Dashboard (Recommended)

#### Step 1: Access Authentication Settings
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**

#### Step 2: Update Site URL
1. In the **Site URL** field, enter: `https://geo-miner.com`
2. This is the default URL users will be redirected to after authentication

#### Step 3: Configure Redirect URLs
1. In the **Redirect URLs** section, add each URL on a new line:
   ```
   https://geo-miner.com/*
   https://www.geo-miner.com/*
   https://staging.geo-miner.com/*
   http://localhost:8080/*
   http://localhost:3000/*
   ```

#### Step 4: Save Configuration
1. Click **Save** to apply the changes
2. Changes take effect immediately

### Method 2: Supabase CLI

#### Step 1: Install and Setup CLI
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

#### Step 2: Update Configuration
```bash
# Update site URL
supabase settings update auth --site-url https://geo-miner.com

# Update redirect URLs (comma-separated)
supabase settings update auth --redirect-urls "https://geo-miner.com/*,https://www.geo-miner.com/*,https://staging.geo-miner.com/*,http://localhost:8080/*,http://localhost:3000/*"
```

#### Step 3: Verify Configuration
```bash
# Check current auth settings
supabase settings get auth
```

### Method 3: Management API (Advanced)

```bash
# Using curl with service role key
curl -X PATCH 'https://YOUR_PROJECT_REF.supabase.co/rest/v1/config' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "SITE_URL": "https://geo-miner.com",
    "URI_ALLOW_LIST": "https://geo-miner.com/*,https://www.geo-miner.com/*,https://staging.geo-miner.com/*,http://localhost:8080/*,http://localhost:3000/*"
  }'
```

## Configuration Screenshots

### Dashboard Navigation
```
Supabase Dashboard
├── Project Selection
├── Authentication (sidebar)
│   ├── Users
│   ├── Policies  
│   ├── Providers
│   └── URL Configuration ← Click here
└── Settings
```

### URL Configuration Screen
```
URL Configuration
┌─────────────────────────────────────┐
│ Site URL                            │
│ https://geo-miner.com              │
├─────────────────────────────────────┤
│ Redirect URLs                       │
│ https://geo-miner.com/*            │
│ https://www.geo-miner.com/*        │
│ https://staging.geo-miner.com/*    │
│ http://localhost:8080/*            │
│ http://localhost:3000/*            │
└─────────────────────────────────────┘
                [Save]
```

## Testing Authentication Flow

### Test Login Redirect
```javascript
// Test login with redirect
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Test login with specific redirect
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://geo-miner.com/dashboard'
  }
})
```

### Test Logout Redirect
```javascript
// Test logout with redirect
await supabase.auth.signOut({
  redirectTo: 'https://geo-miner.com'
})
```

### Manual Testing Steps
1. **Login Flow**:
   - Go to `https://geo-miner.com/login`
   - Click login with OAuth provider
   - Verify redirect back to `https://geo-miner.com/dashboard`

2. **Logout Flow**:
   - Click logout button
   - Verify redirect to `https://geo-miner.com`

3. **Password Reset**:
   - Request password reset
   - Check email contains `https://geo-miner.com` links
   - Click reset link and verify redirect

## Common Issues and Solutions

### Issue: "Invalid redirect URL" Error

**Cause**: The redirect URL is not in the allowed list

**Solution**: 
1. Check the exact URL being used in the error
2. Add the URL to the redirect URLs list
3. Ensure wildcards (`/*`) are used correctly

### Issue: Redirect to Wrong Domain

**Cause**: Site URL is set to old domain

**Solution**:
1. Update Site URL to `https://geo-miner.com`
2. Clear browser cache and cookies
3. Test in incognito/private browsing mode

### Issue: Development Login Not Working

**Cause**: Localhost URLs not in redirect list

**Solution**:
1. Add `http://localhost:8080/*` to redirect URLs
2. Add `http://localhost:3000/*` for alternative dev server
3. Ensure development environment uses correct Supabase keys

### Issue: Staging Environment Issues

**Cause**: Staging URLs not configured

**Solution**:
1. Add staging URLs to redirect list
2. Consider using separate Supabase project for staging
3. Verify staging environment variables

## Security Considerations

### Wildcard Usage
- Use `/*` wildcard to allow all paths under a domain
- Be specific with domains to prevent unauthorized redirects
- Avoid overly broad wildcards like `*`

### HTTPS Enforcement
- Always use HTTPS for production URLs
- HTTP is acceptable only for localhost development
- Supabase enforces HTTPS for production

### Domain Validation
- Supabase validates redirect URLs against the configured list
- Invalid URLs will result in authentication errors
- Keep the list minimal and specific

## Environment-Specific Configuration

### Production Environment
```bash
# Production Supabase configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# Site URL should match
VITE_SITE_URL=https://geo-miner.com
```

### Staging Environment
```bash
# Staging Supabase configuration (can be same project or separate)
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_staging_anon_key

# Site URL should match
VITE_SITE_URL=https://staging.geo-miner.com
```

### Development Environment
```bash
# Development Supabase configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Site URL should match
VITE_SITE_URL=http://localhost:8080
```

## Verification Checklist

After configuration, verify:

- [ ] Site URL is set to `https://geo-miner.com`
- [ ] All required redirect URLs are added
- [ ] Production login/logout works correctly
- [ ] Staging login/logout works correctly (if applicable)
- [ ] Development login/logout works correctly
- [ ] Password reset emails contain correct links
- [ ] OAuth providers redirect correctly
- [ ] No authentication errors in browser console

## Support and Troubleshooting

### Supabase Resources
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [URL Configuration Guide](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui#configure-redirect-urls)
- [Supabase Community](https://github.com/supabase/supabase/discussions)

### Debug Commands
```bash
# Check current configuration
supabase settings get auth

# View auth logs
supabase logs --type auth

# Test auth endpoint
curl -X GET 'https://your-project.supabase.co/auth/v1/settings' \
  -H "apikey: YOUR_ANON_KEY"
```

### Contact Information
- **Supabase Support**: [support@supabase.io](mailto:support@supabase.io)
- **Documentation Issues**: [GitHub Issues](https://github.com/supabase/supabase/issues)
- **Community Help**: [Discord](https://discord.supabase.com/)

## Migration Timeline

When migrating domains:

1. **Pre-migration**: Add new domain URLs to redirect list
2. **During migration**: Keep both old and new URLs active
3. **Post-migration**: Remove old domain URLs after verification
4. **Cleanup**: Update Site URL to new domain

This ensures continuous authentication functionality during the migration process.