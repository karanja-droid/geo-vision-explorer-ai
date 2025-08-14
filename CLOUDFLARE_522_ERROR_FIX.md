# 🔧 Cloudflare 522 Error Fix for geo-miner.com

## 🚨 **Issue Identified**
**Error 522: Connection Timeout** - Cloudflare cannot connect to your origin server.

## 🔍 **Root Cause Analysis**

The 522 error occurs when:
1. **Origin server is down** or unreachable
2. **DNS records point to wrong IP** address
3. **Firewall blocking Cloudflare IPs**
4. **SSL/TLS configuration mismatch**
5. **Origin server overloaded** or slow response

## 🎯 **Current Status**
- **Working URL**: https://sunny-pasca-eed8fc.netlify.app ✅
- **Broken URL**: https://geo-miner.com ❌ (522 Error)
- **Issue**: Custom domain not properly configured

## 🚀 **Quick Fixes**

### **Option 1: Use Netlify Custom Domain (Recommended)**

1. **Go to Netlify Dashboard**:
   - Visit: https://app.netlify.com/sites/sunny-pasca-eed8fc/settings/domain
   - Click "Add custom domain"
   - Enter: `geo-miner.com`

2. **Update DNS Records**:
   ```
   Type: CNAME
   Name: @
   Value: sunny-pasca-eed8fc.netlify.app
   
   Type: CNAME  
   Name: www
   Value: sunny-pasca-eed8fc.netlify.app
   ```

3. **Enable HTTPS**:
   - Netlify will automatically provision SSL certificate
   - Force HTTPS redirect in Netlify settings

### **Option 2: Fix Cloudflare Configuration**

1. **Check DNS Records in Cloudflare**:
   - Login to Cloudflare dashboard
   - Go to DNS settings for geo-miner.com
   - Verify A/CNAME records point to correct server

2. **Current Working Server**: `sunny-pasca-eed8fc.netlify.app`
   ```
   Type: CNAME
   Name: @
   Value: sunny-pasca-eed8fc.netlify.app
   Proxy: ON (Orange cloud)
   ```

3. **SSL/TLS Settings**:
   - Set to "Full" or "Full (strict)"
   - Enable "Always Use HTTPS"

### **Option 3: Temporary Redirect**

Create a simple redirect page while fixing the main domain:

```html
<!DOCTYPE html>
<html>
<head>
    <title>GeoMiner - Redirecting...</title>
    <meta http-equiv="refresh" content="0;url=https://sunny-pasca-eed8fc.netlify.app">
</head>
<body>
    <p>Redirecting to GeoMiner...</p>
    <p>If not redirected, <a href="https://sunny-pasca-eed8fc.netlify.app">click here</a></p>
</body>
</html>
```

## 🔧 **Immediate Action Plan**

### **Step 1: Verify Current Setup**
```bash
# Check DNS resolution
nslookup geo-miner.com
dig geo-miner.com

# Check if server is reachable
curl -I https://sunny-pasca-eed8fc.netlify.app
```

### **Step 2: Update DNS Records**
1. **Login to your domain registrar** (where you bought geo-miner.com)
2. **Update DNS records** to point to Netlify:
   ```
   @ (root)    CNAME    sunny-pasca-eed8fc.netlify.app
   www         CNAME    sunny-pasca-eed8fc.netlify.app
   ```

### **Step 3: Configure Netlify Custom Domain**
1. Go to Netlify dashboard
2. Add geo-miner.com as custom domain
3. Wait for DNS propagation (up to 48 hours)

## 🛠️ **Troubleshooting Steps**

### **Check 1: DNS Propagation**
```bash
# Check DNS from different locations
dig @8.8.8.8 geo-miner.com
dig @1.1.1.1 geo-miner.com
```

### **Check 2: SSL Certificate**
```bash
# Check SSL certificate
openssl s_client -connect geo-miner.com:443 -servername geo-miner.com
```

### **Check 3: Cloudflare Settings**
- **SSL/TLS**: Set to "Full" or "Full (strict)"
- **Security Level**: Medium or lower
- **Browser Integrity Check**: OFF
- **Challenge Passage**: OFF

### **Check 4: Origin Server**
```bash
# Test origin server directly
curl -H "Host: geo-miner.com" https://sunny-pasca-eed8fc.netlify.app
```

## 📋 **DNS Configuration Template**

### **For Cloudflare DNS**:
```
Type    Name    Content                           Proxy
CNAME   @       sunny-pasca-eed8fc.netlify.app   ON
CNAME   www     sunny-pasca-eed8fc.netlify.app   ON
```

### **For Domain Registrar DNS**:
```
Type    Name    Value
CNAME   @       sunny-pasca-eed8fc.netlify.app
CNAME   www     sunny-pasca-eed8fc.netlify.app
```

## 🚨 **Emergency Workaround**

While fixing the domain, users can access the app at:
- **Primary URL**: https://sunny-pasca-eed8fc.netlify.app
- **Status**: ✅ **WORKING PERFECTLY**

## 📞 **Support Contacts**

### **Cloudflare Support**
- Dashboard: https://dash.cloudflare.com
- Support: https://support.cloudflare.com

### **Netlify Support**  
- Dashboard: https://app.netlify.com
- Docs: https://docs.netlify.com/domains-https/custom-domains/

### **Domain Registrar**
- Check where you registered geo-miner.com
- Access their DNS management panel

## ⏱️ **Expected Resolution Time**

- **DNS Changes**: 5-15 minutes
- **SSL Certificate**: 10-30 minutes  
- **Global Propagation**: 2-48 hours
- **Cloudflare Cache**: 5 minutes

## 🎯 **Recommended Solution**

**Use Netlify Custom Domain** (Option 1) because:
- ✅ **Simplest setup** - Netlify handles everything
- ✅ **Automatic SSL** - Free Let's Encrypt certificates
- ✅ **Global CDN** - Fast worldwide access
- ✅ **No server management** - Fully managed hosting
- ✅ **99.9% uptime** - Reliable infrastructure

## 📊 **Status Updates**

- **Current**: geo-miner.com returns 522 error
- **Working**: sunny-pasca-eed8fc.netlify.app is live
- **Action**: Configure custom domain in Netlify
- **ETA**: 15-30 minutes for basic setup

The app is fully functional - it's just a domain configuration issue that can be resolved quickly!