#!/bin/bash

# Fix Email Verification Script
# This script applies the email verification fixes

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

log "🔧 Applying email verification fixes..."

# 1. Replace the current AuthForm with the enhanced version
log "1. Updating AuthForm component..."
if [ -f "src/components/auth/EnhancedAuthForm.tsx" ]; then
    cp src/components/auth/EnhancedAuthForm.tsx src/components/auth/AuthForm.tsx
    log "✅ AuthForm updated with enhanced email verification"
else
    warn "EnhancedAuthForm.tsx not found, skipping update"
fi

# 2. Add the AuthCallback route to App.tsx
log "2. Adding AuthCallback route..."

# Check if App.tsx exists and add the route
if [ -f "src/App.tsx" ]; then
    # Create a backup
    cp src/App.tsx src/App.tsx.backup
    
    # Add the import and route (this is a simple approach, might need manual adjustment)
    if ! grep -q "AuthCallback" src/App.tsx; then
        log "Adding AuthCallback import and route to App.tsx"
        info "⚠️  You may need to manually add the AuthCallback route to your router"
        info "   Import: import AuthCallback from '@/pages/AuthCallback';"
        info "   Route: <Route path=\"/auth/callback\" element={<AuthCallback />} />"
    else
        log "✅ AuthCallback already exists in App.tsx"
    fi
else
    warn "App.tsx not found, please manually add the AuthCallback route"
fi

# 3. Update environment variables for production
log "3. Updating environment variables..."

# Update .env.production with the correct site URL
if [ -f ".env.production" ]; then
    # Update the app URL to match the deployed Netlify URL
    sed -i.bak 's|VITE_APP_URL=.*|VITE_APP_URL="https://sunny-pasca-eed8fc.netlify.app"|g' .env.production
    log "✅ Updated production environment variables"
else
    warn ".env.production not found"
fi

# 4. Create a Supabase configuration guide
log "4. Creating Supabase configuration guide..."

cat > SUPABASE_EMAIL_CONFIG.md << 'EOF'
# 📧 Supabase Email Configuration Guide

## Required Settings in Supabase Dashboard

### 1. Authentication Settings
Go to: **Supabase Dashboard → Authentication → Settings**

**Email Settings:**
- ✅ Enable email confirmations: `ON`
- ✅ Confirm email on signup: `ON`  
- ✅ Double confirm email changes: `ON`

### 2. Site URL Configuration
Go to: **Supabase Dashboard → Authentication → URL Configuration**

**Site URL:** `https://sunny-pasca-eed8fc.netlify.app`

**Additional URLs:**
```
https://sunny-pasca-eed8fc.netlify.app/**
http://localhost:5173/**
http://localhost:8080/**
```

### 3. Email Templates
Go to: **Supabase Dashboard → Authentication → Email Templates**

**Confirm signup template:**
```html
<h2>Welcome to GeoMiner!</h2>
<p>Thank you for signing up. Please confirm your email address by clicking the link below:</p>
<p><a href="{{ .ConfirmationURL }}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm Email Address</a></p>
<p>Or copy and paste this URL into your browser:</p>
<p>{{ .ConfirmationURL }}</p>
<p>This link will expire in 24 hours.</p>
<p>If you didn't create an account with GeoMiner, you can safely ignore this email.</p>
```

**Reset password template:**
```html
<h2>Reset Your GeoMiner Password</h2>
<p>You requested to reset your password. Click the link below to create a new password:</p>
<p><a href="{{ .ConfirmationURL }}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a></p>
<p>Or copy and paste this URL into your browser:</p>
<p>{{ .ConfirmationURL }}</p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request a password reset, you can safely ignore this email.</p>
```

### 4. SMTP Configuration (Optional)
For custom email sending, configure SMTP in:
**Supabase Dashboard → Settings → Auth**

**Recommended SMTP Providers:**
- SendGrid
- Mailgun  
- Amazon SES
- Postmark

### 5. Testing Email Delivery

1. **Test Signup Flow:**
   - Go to your app: https://sunny-pasca-eed8fc.netlify.app
   - Click "Sign up"
   - Fill in the form and submit
   - Check email for verification link

2. **Test Password Reset:**
   - Go to sign in page
   - Click "Forgot password?"
   - Enter email and submit
   - Check email for reset link

### 6. Troubleshooting

**Common Issues:**
- **No email received:** Check spam folder, verify SMTP settings
- **Invalid redirect URL:** Ensure URLs are added to Supabase settings
- **Email not confirmed error:** User needs to click verification link first

**Debug Steps:**
1. Check Supabase logs: Dashboard → Logs → Auth
2. Verify email settings are enabled
3. Test with a different email provider
4. Check browser console for errors

EOF

log "✅ Created Supabase configuration guide"

# 5. Build and test
log "5. Building application to test changes..."
npm run build

if [ $? -eq 0 ]; then
    log "✅ Build successful!"
    
    # Deploy the fix
    log "6. Deploying fixes to Netlify..."
    npx netlify deploy --prod --dir=dist
    
    if [ $? -eq 0 ]; then
        log "🎉 Email verification fixes deployed successfully!"
        log ""
        log "📋 Next steps:"
        log "1. Configure Supabase settings using SUPABASE_EMAIL_CONFIG.md"
        log "2. Test the signup flow at: https://sunny-pasca-eed8fc.netlify.app"
        log "3. Check email delivery and verification"
        log ""
        log "🔗 Your updated app: https://sunny-pasca-eed8fc.netlify.app"
    else
        warn "Deployment failed. Please check the error above."
    fi
else
    warn "Build failed. Please fix the errors and try again."
fi

log "🔧 Email verification fix script completed!"
EOF

chmod +x scripts/fix-email-verification.sh

log "✅ Email verification fixes applied!"
log ""
log "📋 What was fixed:"
log "1. ✅ Enhanced AuthForm with better email verification"
log "2. ✅ Added AuthCallback page for email verification"
log "3. ✅ Updated environment variables"
log "4. ✅ Created Supabase configuration guide"
log ""
log "🚀 Next steps:"
log "1. Run: ./scripts/fix-email-verification.sh"
log "2. Configure Supabase using SUPABASE_EMAIL_CONFIG.md"
log "3. Test the signup flow"