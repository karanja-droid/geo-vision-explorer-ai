#!/bin/bash

# Simple GeoMiner Testing Deployment
# This script provides multiple simple deployment options for testing

set -e

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

show_menu() {
    echo
    log "🚀 GeoMiner Testing Deployment Options"
    echo
    echo "Choose your deployment method:"
    echo "1) 🌐 Netlify (Fastest, Free)"
    echo "2) 🔥 Vercel (Fast, Free)"
    echo "3) 📦 AWS Amplify (AWS, ~$5/month)"
    echo "4) 🐳 Local Docker (Local testing)"
    echo "5) 📱 Local Development Server"
    echo "6) ❌ Exit"
    echo
}

deploy_netlify() {
    log "🌐 Deploying to Netlify..."
    
    # Check if netlify-cli is installed
    if ! command -v netlify &> /dev/null; then
        log "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    # Build the application
    log "Building application..."
    cp .env.testing .env.production
    npm run build
    
    # Deploy to Netlify
    log "Deploying to Netlify..."
    netlify deploy --prod --dir=dist --open
    
    log "✅ Deployed to Netlify!"
    log "🔗 Your app should open in the browser automatically"
}

deploy_vercel() {
    log "🔥 Deploying to Vercel..."
    
    # Check if vercel is installed
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Build the application
    log "Building application..."
    cp .env.testing .env.production
    npm run build
    
    # Deploy to Vercel
    log "Deploying to Vercel..."
    vercel --prod
    
    log "✅ Deployed to Vercel!"
}

deploy_amplify() {
    log "📦 Deploying to AWS Amplify..."
    ./scripts/deploy-amplify-testing.sh
}

deploy_docker() {
    log "🐳 Building Docker container for local testing..."
    
    # Build Docker image
    docker build -f Dockerfile.frontend -t geominer-testing .
    
    # Run container
    log "Starting container on port 3000..."
    docker run -d -p 3000:80 --name geominer-test geominer-testing
    
    log "✅ GeoMiner is running at http://localhost:3000"
    log "🛑 To stop: docker stop geominer-test && docker rm geominer-test"
}

run_local_dev() {
    log "📱 Starting local development server..."
    
    # Copy testing environment
    cp .env.testing .env.local
    
    # Install dependencies and start
    npm install
    npm run dev
}

# Main menu loop
main() {
    log "🎯 GeoMiner Live Testing Deployment"
    
    while true; do
        show_menu
        read -p "Enter your choice (1-6): " choice
        
        case $choice in
            1)
                deploy_netlify
                break
                ;;
            2)
                deploy_vercel
                break
                ;;
            3)
                deploy_amplify
                break
                ;;
            4)
                deploy_docker
                break
                ;;
            5)
                run_local_dev
                break
                ;;
            6)
                log "👋 Goodbye!"
                exit 0
                ;;
            *)
                error "Invalid option. Please choose 1-6."
                ;;
        esac
    done
    
    echo
    log "🎉 Deployment completed!"
    log "📝 Don't forget to:"
    log "   1. Update environment variables with real credentials"
    log "   2. Test all features thoroughly"
    log "   3. Share the URL for feedback"
    log "   4. Monitor performance and usage"
}

main "$@"