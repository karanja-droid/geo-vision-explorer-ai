#!/bin/bash

# Fix Cloudflare 522 Error for geo-miner.com
# This script helps diagnose and provides steps to fix the domain issue

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Domain configuration
CUSTOM_DOMAIN="geo-miner.com"
NETLIFY_DOMAIN="sunny-pasca-eed8fc.netlify.app"
WORKING_URL="https://$NETLIFY_DOMAIN"

log "🔧 Diagnosing Cloudflare 522 Error for $CUSTOM_DOMAIN"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    if ! command_exists curl; then
        warn "curl not found, some tests will be skipped"
    fi
    
    if ! command_exists dig; then
        warn "dig not found, DNS tests will be skipped"
    fi
    
    if ! command_exists nslookup; then
        warn "nslookup not found, some DNS tests will be skipped"
    fi
}

# Test working URL
test_working_url() {
    log "✅ Testing working URL: $WORKING_URL"
    
    if command_exists curl; then
        if curl -s -o /dev/null -w "%{http_code}" "$WORKING_URL" | grep -q "200"; then
            log "✅ Working URL is accessible (HTTP 200)"
        else
            error "❌ Working URL is not accessible"
        fi
    else
        info "curl not available, skipping HTTP test"
    fi
}

# Test broken domain
test_broken_domain() {
    log "🔍 Testing broken domain: https://$CUSTOM_DOMAIN"
    
    if command_exists curl; then
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$CUSTOM_DOMAIN" || echo "000")
        if [ "$HTTP_CODE" = "522" ] || [ "$HTTP_CODE" = "000" ]; then
            error "❌ Domain returns error $HTTP_CODE (Connection timeout)"
        else
            log "✅ Domain returns HTTP $HTTP_CODE"
        fi
    else
        info "curl not available, skipping HTTP test"
    fi
}

# Check DNS resolution
check_dns() {
    log "🔍 Checking DNS resolution for $CUSTOM_DOMAIN"
    
    if command_exists dig; then
        log "DNS A records:"
        dig +short A "$CUSTOM_DOMAIN" || warn "No A records found"
        
        log "DNS CNAME records:"
        dig +short CNAME "$CUSTOM_DOMAIN" || warn "No CNAME records found"
        
        log "DNS resolution from Google DNS:"
        dig @8.8.8.8 +short "$CUSTOM_DOMAIN" || warn "Google DNS resolution failed"
        
        log "DNS resolution from Cloudflare DNS:"
        dig @1.1.1.1 +short "$CUSTOM_DOMAIN" || warn "Cloudflare DNS resolution failed"
    elif command_exists nslookup; then
        log "Using nslookup for DNS check:"
        nslookup "$CUSTOM_DOMAIN" || warn "nslookup failed"
    else
        warn "No DNS tools available, skipping DNS tests"
    fi
}

# Check SSL certificate
check_ssl() {
    log "🔍 Checking SSL certificate for $CUSTOM_DOMAIN"
    
    if command_exists openssl; then
        echo | openssl s_client -connect "$CUSTOM_DOMAIN:443" -servername "$CUSTOM_DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || warn "SSL certificate check failed"
    else
        warn "openssl not available, skipping SSL test"
    fi
}

# Provide fix recommendations
provide_recommendations() {
    log "💡 Fix Recommendations:"
    echo
    info "🎯 IMMEDIATE SOLUTION:"
    info "   Use the working URL while fixing domain:"
    info "   👉 $WORKING_URL"
    echo
    info "🔧 PERMANENT FIX OPTIONS:"
    echo
    info "Option 1: Configure Netlify Custom Domain (RECOMMENDED)"
    info "   1. Go to: https://app.netlify.com/sites/sunny-pasca-eed8fc/settings/domain"
    info "   2. Click 'Add custom domain'"
    info "   3. Enter: $CUSTOM_DOMAIN"
    info "   4. Follow Netlify's DNS instructions"
    echo
    info "Option 2: Fix Cloudflare DNS Settings"
    info "   1. Login to Cloudflare dashboard"
    info "   2. Go to DNS settings for $CUSTOM_DOMAIN"
    info "   3. Add/Update CNAME record:"
    info "      Name: @ (root)"
    info "      Content: $NETLIFY_DOMAIN"
    info "      Proxy: ON (orange cloud)"
    info "   4. Add CNAME for www:"
    info "      Name: www"
    info "      Content: $NETLIFY_DOMAIN"
    info "      Proxy: ON (orange cloud)"
    echo
    info "Option 3: Update Domain Registrar DNS"
    info "   1. Login to your domain registrar"
    info "   2. Go to DNS management"
    info "   3. Add CNAME records:"
    info "      @ → $NETLIFY_DOMAIN"
    info "      www → $NETLIFY_DOMAIN"
    echo
    warn "⏱️  DNS changes can take 5 minutes to 48 hours to propagate globally"
}

# Generate DNS configuration file
generate_dns_config() {
    log "📝 Generating DNS configuration file..."
    
    cat > dns-configuration.txt << EOF
# DNS Configuration for $CUSTOM_DOMAIN
# Generated on $(date)

## For Cloudflare DNS Management:
Type    Name    Content                     Proxy   TTL
CNAME   @       $NETLIFY_DOMAIN            ON      Auto
CNAME   www     $NETLIFY_DOMAIN            ON      Auto

## For Domain Registrar DNS:
Type    Name    Value
CNAME   @       $NETLIFY_DOMAIN
CNAME   www     $NETLIFY_DOMAIN

## Cloudflare SSL/TLS Settings:
- SSL/TLS encryption mode: Full or Full (strict)
- Always Use HTTPS: ON
- Minimum TLS Version: 1.2
- Opportunistic Encryption: ON
- TLS 1.3: ON

## Verification Commands:
dig $CUSTOM_DOMAIN
nslookup $CUSTOM_DOMAIN
curl -I https://$CUSTOM_DOMAIN

## Working URL (use while fixing):
$WORKING_URL
EOF
    
    log "✅ DNS configuration saved to dns-configuration.txt"
}

# Main diagnostic function
main() {
    log "🚀 Starting Cloudflare 522 Error Diagnosis"
    echo
    
    check_prerequisites
    echo
    
    test_working_url
    echo
    
    test_broken_domain
    echo
    
    check_dns
    echo
    
    check_ssl
    echo
    
    provide_recommendations
    echo
    
    generate_dns_config
    echo
    
    log "🎉 Diagnosis completed!"
    log "📋 Summary:"
    log "   ✅ Working URL: $WORKING_URL"
    log "   ❌ Broken domain: https://$CUSTOM_DOMAIN (522 error)"
    log "   🔧 Fix: Configure custom domain in Netlify or update DNS"
    log "   📄 DNS config: dns-configuration.txt"
    echo
    warn "💡 Quick fix: Use $WORKING_URL while configuring the custom domain"
}

# Run main function
main "$@"