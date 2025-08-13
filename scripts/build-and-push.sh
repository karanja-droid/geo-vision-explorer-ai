#!/bin/bash

# Build and Push Docker Images to AWS ECR
# Usage: ./scripts/build-and-push.sh [region] [tag]

set -e

AWS_REGION=${1:-us-west-2}
IMAGE_TAG=${2:-latest}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

log "🚀 Building and pushing GeoMiner Docker images..."

# Login to ECR
log "🔐 Logging in to Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Create ECR repositories if they don't exist
log "📦 Creating ECR repositories..."
aws ecr describe-repositories --repository-names geominer/frontend --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name geominer/frontend --region $AWS_REGION

aws ecr describe-repositories --repository-names geominer/backend --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name geominer/backend --region $AWS_REGION

# Build frontend image
log "🏗️ Building frontend image..."
docker build -t geominer/frontend:$IMAGE_TAG -f Dockerfile.frontend .

# Tag and push frontend
log "📤 Pushing frontend image..."
docker tag geominer/frontend:$IMAGE_TAG $ECR_REGISTRY/geominer/frontend:$IMAGE_TAG
docker push $ECR_REGISTRY/geominer/frontend:$IMAGE_TAG

# Build backend image (if Dockerfile.backend exists)
if [ -f "Dockerfile.backend" ]; then
    log "🏗️ Building backend image..."
    docker build -t geominer/backend:$IMAGE_TAG -f Dockerfile.backend .
    
    log "📤 Pushing backend image..."
    docker tag geominer/backend:$IMAGE_TAG $ECR_REGISTRY/geominer/backend:$IMAGE_TAG
    docker push $ECR_REGISTRY/geominer/backend:$IMAGE_TAG
fi

# Update Kubernetes deployment files with new image tags
log "🔄 Updating Kubernetes deployment files..."
if [ -f "k8s/deployment.yaml" ]; then
    sed -i.bak "s|image: .*geominer/frontend:.*|image: $ECR_REGISTRY/geominer/frontend:$IMAGE_TAG|g" k8s/deployment.yaml
    sed -i.bak "s|image: .*geominer/backend:.*|image: $ECR_REGISTRY/geominer/backend:$IMAGE_TAG|g" k8s/deployment.yaml
    rm k8s/deployment.yaml.bak
fi

log "✅ Build and push completed successfully!"
info "Frontend image: $ECR_REGISTRY/geominer/frontend:$IMAGE_TAG"
if [ -f "Dockerfile.backend" ]; then
    info "Backend image: $ECR_REGISTRY/geominer/backend:$IMAGE_TAG"
fi

log "🎯 Next steps:"
log "1. Deploy to Kubernetes: kubectl apply -f k8s/"
log "2. Check deployment status: kubectl get pods -n geominer"
log "3. Get service URL: kubectl get ingress -n geominer"