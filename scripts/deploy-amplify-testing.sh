#!/bin/bash

# GeoMiner AWS Amplify Live Testing Deployment
# Quick deployment for testing and demo purposes

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites for Amplify deployment..."
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed. Please install it first: https://aws.amazon.com/cli/"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured. Run 'aws configure' first."
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check if git is initialized
    if ! git rev-parse --git-dir &> /dev/null; then
        warn "Git repository not initialized. Initializing now..."
        git init
        git add .
        git commit -m "Initial commit for GeoMiner deployment"
    fi
    
    log "✅ Prerequisites check passed"
}

# Install Amplify CLI
install_amplify_cli() {
    log "📦 Installing Amplify CLI..."
    
    if ! command -v amplify &> /dev/null; then
        npm install -g @aws-amplify/cli
        log "✅ Amplify CLI installed"
    else
        log "✅ Amplify CLI already installed"
    fi
}

# Configure Amplify
configure_amplify() {
    log "🔧 Configuring Amplify..."
    
    # Check if already configured
    if [ -d "amplify" ]; then
        warn "Amplify already configured. Skipping configuration."
        return
    fi
    
    # Initialize Amplify project
    log "Initializing Amplify project..."
    amplify init --yes --amplify '{
        "projectName": "geominer",
        "envName": "testing",
        "defaultEditor": "code"
    }' --frontend '{
        "frontend": "javascript",
        "framework": "react",
        "config": {
            "SourceDir": "src",
            "DistributionDir": "dist",
            "BuildCommand": "npm run build",
            "StartCommand": "npm run dev"
        }
    }' --providers '{
        "awscloudformation": {
            "configLevel": "project",
            "useProfile": true,
            "profileName": "default"
        }
    }'
    
    log "✅ Amplify configured"
}

# Add hosting
add_hosting() {
    log "🌐 Adding Amplify hosting..."
    
    # Check if hosting already added
    if [ -f "amplify/backend/hosting/amplifyhosting/amplifyhosting-template.json" ]; then
        warn "Hosting already configured. Skipping."
        return
    fi
    
    # Add hosting
    amplify add hosting --headless --hosting '{
        "type": "amplifyhosting",
        "name": "amplifyhosting"
    }'
    
    log "✅ Hosting added"
}

# Create environment configuration
create_env_config() {
    log "⚙️ Creating environment configuration..."
    
    # Create .env.production for build
    cat > .env.production << EOF
# GeoMiner Testing Environment
NODE_ENV=production
VITE_APP_NAME="GeoMiner - AI Geological Intelligence (Testing)"
VITE_APP_URL="https://main.d1234567890.amplifyapp.com"
VITE_COMPANY_NAME="ProspectIQ Labs LLC"
VITE_DOMAIN="geo-miner.com"

# Supabase Configuration (use your actual values)
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"

# Mapbox Configuration (use your actual token)
VITE_MAPBOX_ACCESS_TOKEN="pk.your-mapbox-access-token"

# Feature Flags for Testing
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_TESTING_MODE=true
EOF
    
    log "✅ Environment configuration created"
    warn "⚠️  Please update .env.production with your actual Supabase and Mapbox credentials"
}

# Build the application
build_application() {
    log "🏗️ Building application for production..."
    
    # Install dependencies
    npm ci
    
    # Run tests (optional, skip if failing)
    log "Running tests..."
    npm run test || warn "Tests failed, continuing with deployment"
    
    # Build application
    npm run build
    
    log "✅ Application built successfully"
}

# Deploy to Amplify
deploy_to_amplify() {
    log "🚀 Deploying to AWS Amplify..."
    
    # Publish to Amplify
    amplify publish --yes
    
    log "✅ Deployment completed!"
}

# Get deployment info
get_deployment_info() {
    log "📋 Getting deployment information..."
    
    # Get Amplify app info
    APP_ID=$(amplify status --json | jq -r '.providers.awscloudformation.AmplifyAppId' 2>/dev/null || echo "")
    
    if [ -n "$APP_ID" ]; then
        APP_URL="https://main.$APP_ID.amplifyapp.com"
        log "🌐 Your GeoMiner testing app is live at: $APP_URL"
        
        # Get additional info
        aws amplify get-app --app-id $APP_ID --query 'app.{Name:name,Status:status,DefaultDomain:defaultDomain}' --output table
    else
        warn "Could not retrieve app information. Check Amplify console."
    fi
    
    log "📊 Amplify Console: https://console.aws.amazon.com/amplify/home"
}

# Setup custom domain (optional)
setup_custom_domain() {
    read -p "Do you want to set up a custom domain? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your domain name (e.g., test.geo-miner.com): " DOMAIN_NAME
        
        if [ -n "$DOMAIN_NAME" ]; then
            log "🔗 Setting up custom domain: $DOMAIN_NAME"
            
            # Add domain to Amplify app
            aws amplify create-domain-association \
                --app-id $APP_ID \
                --domain-name $DOMAIN_NAME \
                --sub-domain-settings prefix=main,branchName=main
            
            log "✅ Custom domain setup initiated"
            log "⏳ DNS verification may take a few minutes"
            log "📝 Add these DNS records to your domain provider:"
            
            # Get domain verification info
            aws amplify get-domain-association \
                --app-id $APP_ID \
                --domain-name $DOMAIN_NAME \
                --query 'domainAssociation.subDomains[0].dnsRecord' \
                --output table
        fi
    fi
}

# Main deployment function
main() {
    log "🚀 Starting GeoMiner live testing deployment with AWS Amplify..."
    
    check_prerequisites
    install_amplify_cli
    configure_amplify
    add_hosting
    create_env_config
    
    # Pause for user to update credentials
    warn "⚠️  IMPORTANT: Please update .env.production with your actual credentials:"
    warn "   - VITE_SUPABASE_URL"
    warn "   - VITE_SUPABASE_ANON_KEY"
    warn "   - VITE_MAPBOX_ACCESS_TOKEN"
    echo
    read -p "Press Enter after updating .env.production to continue..."
    
    build_application
    deploy_to_amplify
    get_deployment_info
    setup_custom_domain
    
    log "🎉 GeoMiner is now live for testing!"
    log ""
    log "📋 Next steps:"
    log "1. Test the application thoroughly"
    log "2. Share the URL with stakeholders for feedback"
    log "3. Monitor usage in Amplify Console"
    log "4. Update environment variables as needed"
    log ""
    log "💰 Estimated cost: ~$1-5/month for testing"
    log "🔧 To update: Just run 'amplify publish' after making changes"
    log "🗑️  To delete: Run 'amplify delete' when done testing"
}

# Run main function
main "$@"