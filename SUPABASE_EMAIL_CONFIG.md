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

