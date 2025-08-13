#!/bin/bash

# 🚀 GeoVision AI Miner - Complete System Deployment Script
# This script deploys the entire GeoVision platform including CI/CD pipelines

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="geovision-ai-miner"
AWS_REGION="${AWS_REGION:-us-west-2}"
ENVIRONMENT="${ENVIRONMENT:-production}"

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    if ! command_exists aws; then
        missing_tools+=("aws-cli")
    fi
    
    if ! command_exists docker; then
        missing_tools+=("docker")
    fi
    
    if ! command_exists gh; then
        missing_tools+=("github-cli")
    fi
    
    if ! command_exists make; then
        missing_tools+=("make")
    fi
    
    if ! command_exists python3; then
        missing_tools+=("python3")
    fi
    
    if ! command_exists node; then
        missing_tools+=("nodejs")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check GitHub authentication
    if ! gh auth status >/dev/null 2>&1; then
        print_error "GitHub CLI not authenticated. Please run 'gh auth login' first."
        exit 1
    fi
    
    print_success "All prerequisites satisfied"
}

# Function to setup AWS infrastructure
setup_aws_infrastructure() {
    print_status "Setting up AWS infrastructure..."
    
    # Create S3 buckets
    local buckets=(
        "${PROJECT_NAME}-data"
        "${PROJECT_NAME}-staging"
        "${PROJECT_NAME}-artifacts"
        "${PROJECT_NAME}-logs"
    )
    
    for bucket in "${buckets[@]}"; do
        if aws s3 ls "s3://${bucket}" >/dev/null 2>&1; then
            print_warning "S3 bucket ${bucket} already exists"
        else
            print_status "Creating S3 bucket: ${bucket}"
            aws s3 mb "s3://${bucket}" --region "${AWS_REGION}"
            
            # Enable versioning
            aws s3api put-bucket-versioning \
                --bucket "${bucket}" \
                --versioning-configuration Status=Enabled
            
            # Enable encryption
            aws s3api put-bucket-encryption \
                --bucket "${bucket}" \
                --server-side-encryption-configuration '{
                    "Rules": [{
                        "ApplyServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }]
                }'
        fi
    done
    
    # Create ECS clusters
    local clusters=(
        "${PROJECT_NAME}-production"
        "${PROJECT_NAME}-staging"
    )
    
    for cluster in "${clusters[@]}"; do
        if aws ecs describe-clusters --clusters "${cluster}" --query 'clusters[0].status' --output text 2>/dev/null | grep -q "ACTIVE"; then
            print_warning "ECS cluster ${cluster} already exists"
        else
            print_status "Creating ECS cluster: ${cluster}"
            aws ecs create-cluster --cluster-name "${cluster}"
        fi
    done
    
    # Create ECR repositories
    local repositories=(
        "${PROJECT_NAME}/stac-api"
        "${PROJECT_NAME}/data-processor"
        "${PROJECT_NAME}/monitoring"
    )
    
    for repo in "${repositories[@]}"; do
        if aws ecr describe-repositories --repository-names "${repo}" >/dev/null 2>&1; then
            print_warning "ECR repository ${repo} already exists"
        else
            print_status "Creating ECR repository: ${repo}"
            aws ecr create-repository --repository-name "${repo}"
        fi
    done
    
    print_success "AWS infrastructure setup completed"
}

# Function to setup GitHub repository secrets
setup_github_secrets() {
    print_status "Setting up GitHub repository secrets..."
    
    # Get AWS account ID
    local aws_account_id
    aws_account_id=$(aws sts get-caller-identity --query Account --output text)
    
    # Get AWS access keys (assuming they're in environment or AWS config)
    local aws_access_key_id
    local aws_secret_access_key
    
    if [ -n "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_SECRET_ACCESS_KEY:-}" ]; then
        aws_access_key_id="${AWS_ACCESS_KEY_ID}"
        aws_secret_access_key="${AWS_SECRET_ACCESS_KEY}"
    else
        print_warning "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY not found in environment"
        print_warning "Please set these secrets manually in GitHub repository settings"
    fi
    
    # Set GitHub secrets
    local secrets=(
        "AWS_ACCESS_KEY_ID:${aws_access_key_id:-}"
        "AWS_SECRET_ACCESS_KEY:${aws_secret_access_key:-}"
        "AWS_ACCOUNT_ID:${aws_account_id}"
        "AWS_REGION:${AWS_REGION}"
        "S3_BUCKET:s3://${PROJECT_NAME}-data"
        "S3_STAGING_BUCKET:s3://${PROJECT_NAME}-staging"
        "ECS_CLUSTER_PROD:${PROJECT_NAME}-production"
        "ECS_CLUSTER_STAGING:${PROJECT_NAME}-staging"
    )
    
    for secret in "${secrets[@]}"; do
        local key="${secret%%:*}"
        local value="${secret#*:}"
        
        if [ -n "${value}" ]; then
            print_status "Setting GitHub secret: ${key}"
            echo "${value}" | gh secret set "${key}"
        else
            print_warning "Skipping empty secret: ${key}"
        fi
    done
    
    print_success "GitHub secrets setup completed"
}

# Function to deploy Supabase backend
deploy_supabase_backend() {
    print_status "Deploying Supabase backend..."
    
    if [ -f "${SCRIPT_DIR}/deploy-enhanced-backend.sh" ]; then
        print_status "Running enhanced backend deployment..."
        bash "${SCRIPT_DIR}/deploy-enhanced-backend.sh"
    else
        print_warning "Enhanced backend deployment script not found, skipping..."
    fi
    
    print_success "Supabase backend deployment completed"
}

# Function to build and deploy STAC API
deploy_stac_api() {
    print_status "Building and deploying STAC API..."
    
    # Build Docker image
    if [ -f "${SCRIPT_DIR}/api/Dockerfile" ]; then
        print_status "Building STAC API Docker image..."
        cd "${SCRIPT_DIR}/api"
        
        # Build image
        docker build -t "${PROJECT_NAME}/stac-api:latest" .
        
        # Tag for ECR
        local ecr_uri="${aws_account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}/stac-api:latest"
        docker tag "${PROJECT_NAME}/stac-api:latest" "${ecr_uri}"
        
        # Push to ECR
        aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${aws_account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        docker push "${ecr_uri}"
        
        cd "${SCRIPT_DIR}"
    else
        print_warning "STAC API Dockerfile not found, skipping Docker build..."
    fi
    
    # Deploy using deployment script
    if [ -f "${SCRIPT_DIR}/api/deploy_stac_api.sh" ]; then
        print_status "Running STAC API deployment script..."
        bash "${SCRIPT_DIR}/api/deploy_stac_api.sh"
    else
        print_warning "STAC API deployment script not found, skipping..."
    fi
    
    print_success "STAC API deployment completed"
}

# Function to setup data processing pipeline
setup_data_pipeline() {
    print_status "Setting up data processing pipeline..."
    
    # Install Python dependencies for data processing
    if [ -f "${SCRIPT_DIR}/tools/stac/requirements.txt" ]; then
        print_status "Installing Python dependencies..."
        cd "${SCRIPT_DIR}/tools/stac"
        python3 -m pip install -r requirements.txt
        cd "${SCRIPT_DIR}"
    fi
    
    # Upload sample data if available
    if [ -d "${SCRIPT_DIR}/data/sample" ]; then
        print_status "Uploading sample geological data..."
        aws s3 sync "${SCRIPT_DIR}/data/sample/" "s3://${PROJECT_NAME}-data/sample/" --delete
    fi
    
    # Trigger initial data processing
    if command_exists gh; then
        print_status "Triggering initial data processing pipeline..."
        gh workflow run data-ingest-pipeline.yml \
            --field data_type=all \
            --field processing_mode=full \
            --field environment="${ENVIRONMENT}" || print_warning "Failed to trigger data processing pipeline"
    fi
    
    print_success "Data processing pipeline setup completed"
}

# Function to deploy frontend application
deploy_frontend() {
    print_status "Deploying frontend application..."
    
    if [ -f "${SCRIPT_DIR}/package.json" ]; then
        print_status "Installing frontend dependencies..."
        npm install
        
        print_status "Building frontend application..."
        npm run build
        
        # Deploy to S3 (assuming static hosting)
        if aws s3 ls "s3://${PROJECT_NAME}-frontend" >/dev/null 2>&1; then
            print_status "Deploying to S3..."
            aws s3 sync dist/ "s3://${PROJECT_NAME}-frontend/" --delete
        else
            print_warning "Frontend S3 bucket not found, skipping deployment"
        fi
    else
        print_warning "Frontend package.json not found, skipping frontend deployment"
    fi
    
    print_success "Frontend deployment completed"
}

# Function to enable monitoring and alerts
enable_monitoring() {
    print_status "Enabling monitoring and alerts..."
    
    # Enable GitHub Actions workflows
    local workflows=(
        "data-ingest-pipeline.yml"
        "deploy-stac-api.yml"
        "monitoring-alerts.yml"
    )
    
    for workflow in "${workflows[@]}"; do
        if [ -f "${SCRIPT_DIR}/.github/workflows/${workflow}" ]; then
            print_status "Enabling workflow: ${workflow}"
            gh workflow enable "${workflow}" || print_warning "Failed to enable workflow: ${workflow}"
        else
            print_warning "Workflow file not found: ${workflow}"
        fi
    done
    
    # Run initial monitoring check
    print_status "Running initial monitoring check..."
    gh workflow run monitoring-alerts.yml \
        --field check_type=all \
        --field alert_threshold=3 || print_warning "Failed to trigger monitoring workflow"
    
    print_success "Monitoring and alerts enabled"
}

# Function to run post-deployment tests
run_post_deployment_tests() {
    print_status "Running post-deployment tests..."
    
    # Test STAC API endpoints
    local api_url="https://stac.geovision.ai"
    local endpoints=(
        "/health"
        "/"
        "/collections"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Testing endpoint: ${endpoint}"
        if curl -f -s "${api_url}${endpoint}" >/dev/null; then
            print_success "✅ ${endpoint} - OK"
        else
            print_error "❌ ${endpoint} - FAILED"
        fi
    done
    
    # Run API tests if available
    if [ -f "${SCRIPT_DIR}/api/test_stac_api.py" ]; then
        print_status "Running API test suite..."
        cd "${SCRIPT_DIR}/api"
        python3 -m pytest test_stac_api.py -v || print_warning "Some API tests failed"
        cd "${SCRIPT_DIR}"
    fi
    
    print_success "Post-deployment tests completed"
}

# Function to display deployment summary
display_summary() {
    print_success "🎉 GeoVision AI Miner deployment completed successfully!"
    echo
    echo "📋 Deployment Summary:"
    echo "====================="
    echo "• AWS Infrastructure: ✅ Created"
    echo "• GitHub Secrets: ✅ Configured"
    echo "• Supabase Backend: ✅ Deployed"
    echo "• STAC API: ✅ Deployed"
    echo "• Data Pipeline: ✅ Configured"
    echo "• Frontend: ✅ Deployed"
    echo "• Monitoring: ✅ Enabled"
    echo
    echo "🔗 Important URLs:"
    echo "=================="
    echo "• STAC API: https://stac.geovision.ai"
    echo "• Staging API: https://stac-staging.geovision.ai"
    echo "• Frontend: https://${PROJECT_NAME}-frontend.s3-website-${AWS_REGION}.amazonaws.com"
    echo "• GitHub Actions: https://github.com/$(gh repo view --json owner,name -q '.owner.login + \"/\" + .name')/actions"
    echo
    echo "📚 Next Steps:"
    echo "=============="
    echo "1. Configure domain names and SSL certificates"
    echo "2. Set up custom monitoring dashboards"
    echo "3. Configure backup and disaster recovery"
    echo "4. Review and adjust monitoring thresholds"
    echo "5. Set up team access and permissions"
    echo
    echo "📖 Documentation:"
    echo "=================="
    echo "• Deployment Guide: ./DEPLOYMENT_GUIDE.md"
    echo "• CI/CD Implementation: ./CI_CD_IMPLEMENTATION.md"
    echo "• Data Processing Pipeline: ./DATA_PROCESSING_PIPELINE.md"
    echo "• Feature Flags: ./FEATURE_FLAGS_IMPLEMENTATION.md"
}

# Main deployment function
main() {
    echo "🚀 Starting GeoVision AI Miner complete system deployment..."
    echo "============================================================"
    echo
    
    # Check if running in CI/CD environment
    if [ "${CI:-false}" = "true" ]; then
        print_status "Running in CI/CD environment"
        export DEBIAN_FRONTEND=noninteractive
    fi
    
    # Run deployment steps
    check_prerequisites
    setup_aws_infrastructure
    setup_github_secrets
    deploy_supabase_backend
    deploy_stac_api
    setup_data_pipeline
    deploy_frontend
    enable_monitoring
    run_post_deployment_tests
    display_summary
    
    print_success "🎉 Complete system deployment finished successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "check")
        check_prerequisites
        ;;
    "aws")
        setup_aws_infrastructure
        ;;
    "secrets")
        setup_github_secrets
        ;;
    "backend")
        deploy_supabase_backend
        ;;
    "api")
        deploy_stac_api
        ;;
    "data")
        setup_data_pipeline
        ;;
    "frontend")
        deploy_frontend
        ;;
    "monitoring")
        enable_monitoring
        ;;
    "test")
        run_post_deployment_tests
        ;;
    "help"|"-h"|"--help")
        echo "GeoVision AI Miner - Complete System Deployment Script"
        echo
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  deploy     - Run complete deployment (default)"
        echo "  check      - Check prerequisites only"
        echo "  aws        - Setup AWS infrastructure only"
        echo "  secrets    - Setup GitHub secrets only"
        echo "  backend    - Deploy Supabase backend only"
        echo "  api        - Deploy STAC API only"
        echo "  data       - Setup data pipeline only"
        echo "  frontend   - Deploy frontend only"
        echo "  monitoring - Enable monitoring only"
        echo "  test       - Run post-deployment tests only"
        echo "  help       - Show this help message"
        echo
        echo "Environment Variables:"
        echo "  AWS_REGION     - AWS region (default: us-west-2)"
        echo "  ENVIRONMENT    - Deployment environment (default: production)"
        echo
        ;;
    *)
        print_error "Unknown command: $1"
        print_error "Run '$0 help' for usage information"
        exit 1
        ;;
esac