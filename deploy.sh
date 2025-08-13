#!/bin/bash

# GeoVision AI Miner - Final Deployment Script
# Automates the deployment process with all necessary checks

set -e

echo "🌍 GeoVision AI Miner - Final Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

print_status "Starting deployment process..."

# Step 1: Check for required files
print_status "Checking deployment files..."

required_files=(
    "public/_redirects"
    "netlify.toml"
    "src/pages/Auth.tsx"
    "src/integrations/supabase/client.ts"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file missing"
        exit 1
    fi
done

# Step 2: Check environment variables
print_status "Checking environment variables..."

if [ -f ".env.local" ]; then
    print_success "✓ .env.local found"
    
    # Check for required variables
    if grep -q "VITE_SUPABASE_URL" .env.local; then
        print_success "✓ VITE_SUPABASE_URL configured"
    else
        print_warning "⚠ VITE_SUPABASE_URL not found in .env.local"
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY" .env.local; then
        print_success "✓ VITE_SUPABASE_ANON_KEY configured"
    else
        print_warning "⚠ VITE_SUPABASE_ANON_KEY not found in .env.local"
    fi
else
    print_warning "⚠ .env.local not found - make sure environment variables are set in Netlify"
fi

# Step 3: Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "✓ Dependencies installed"
else
    print_error "✗ Failed to install dependencies"
    exit 1
fi

# Step 4: Run build test
print_status "Testing build process..."
if npm run build; then
    print_success "✓ Build successful"
else
    print_error "✗ Build failed"
    exit 1
fi

# Step 5: Check build output
print_status "Checking build output..."
if [ -d "dist" ]; then
    print_success "✓ Build directory created"
    
    # Check for key files
    if [ -f "dist/index.html" ]; then
        print_success "✓ index.html generated"
    else
        print_error "✗ index.html not found in build"
        exit 1
    fi
    
    if [ -f "dist/_redirects" ]; then
        print_success "✓ _redirects file copied to build"
    else
        print_warning "⚠ _redirects file not found in build"
    fi
else
    print_error "✗ Build directory not created"
    exit 1
fi

# Step 6: Git status check
print_status "Checking git status..."
if git status --porcelain | grep -q .; then
    print_warning "⚠ Uncommitted changes detected"
    
    echo "Uncommitted files:"
    git status --porcelain
    
    read -p "Do you want to commit these changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Committing changes..."
        git add .
        git commit -m "Final deployment configuration - $(date)"
        print_success "✓ Changes committed"
    else
        print_warning "⚠ Proceeding without committing changes"
    fi
else
    print_success "✓ No uncommitted changes"
fi

# Step 7: Push to repository
print_status "Pushing to repository..."
if git push origin main; then
    print_success "✓ Changes pushed to repository"
else
    print_error "✗ Failed to push changes"
    exit 1
fi

# Step 8: Deployment instructions
echo ""
echo "🚀 DEPLOYMENT NEXT STEPS"
echo "========================"
echo ""
print_status "1. Netlify will automatically build and deploy (3-5 minutes)"
print_status "2. Configure environment variables in Netlify Dashboard:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
echo ""
print_status "3. Configure Supabase Authentication:"
echo "   - Site URL: https://sunny-pasca-eed8fc.netlify.app"
echo "   - Enable email confirmations (or disable for testing)"
echo ""
print_status "4. Test the deployment:"
echo "   - https://sunny-pasca-eed8fc.netlify.app/"
echo "   - https://sunny-pasca-eed8fc.netlify.app/auth"
echo ""

# Step 9: Start local STAC API if available
if [ -f "api/start_dev_server.sh" ]; then
    print_status "STAC API available - you can start it locally:"
    echo "   cd api && ./start_dev_server.sh"
    echo ""
fi

# Step 10: Final checklist
echo "📋 POST-DEPLOYMENT CHECKLIST"
echo "============================"
echo "□ Netlify build completed successfully"
echo "□ Environment variables configured in Netlify"
echo "□ Supabase Site URL updated"
echo "□ Authentication flow tested"
echo "□ Email confirmation working (or disabled)"
echo "□ All routes accessible (no 404s)"
echo "□ STAC API integration functional"
echo ""

print_success "🎉 Deployment script completed successfully!"
print_status "Monitor the deployment at: https://app.netlify.com/sites/sunny-pasca-eed8fc/deploys"

# Optional: Open deployment URL
if command -v xdg-open > /dev/null; then
    read -p "Open Netlify dashboard? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "https://app.netlify.com/sites/sunny-pasca-eed8fc/deploys"
    fi
elif command -v open > /dev/null; then
    read -p "Open Netlify dashboard? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "https://app.netlify.com/sites/sunny-pasca-eed8fc/deploys"
    fi
fi

echo ""
print_success "🌍 GeoVision AI Miner deployment initiated! ⛏️✨"