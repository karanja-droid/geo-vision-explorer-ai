#!/bin/bash

# GeoVision AI Miner - STAC API Deployment Script
# Deploys the FastAPI STAC server to production

set -e

echo "🌍 GeoVision AI Miner - STAC API Deployment"
echo "==========================================="

# Configuration
DOCKER_IMAGE="geovision/stac-api"
DOCKER_TAG=${1:-latest}
REGISTRY=${DOCKER_REGISTRY:-""}
ENVIRONMENT=${ENVIRONMENT:-production}

echo "📋 Deployment Configuration:"
echo "  Image: $DOCKER_IMAGE:$DOCKER_TAG"
echo "  Registry: ${REGISTRY:-"local"}"
echo "  Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Build Docker image
echo "🏗️  Building Docker image..."
docker build -t $DOCKER_IMAGE:$DOCKER_TAG .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Docker image build failed"
    exit 1
fi

# Tag and push to registry if specified
if [ ! -z "$REGISTRY" ]; then
    echo "📤 Pushing to registry..."
    docker tag $DOCKER_IMAGE:$DOCKER_TAG $REGISTRY/$DOCKER_IMAGE:$DOCKER_TAG
    docker push $REGISTRY/$DOCKER_IMAGE:$DOCKER_TAG
    
    if [ $? -eq 0 ]; then
        echo "✅ Image pushed to registry successfully"
    else
        echo "❌ Failed to push image to registry"
        exit 1
    fi
fi

# Run tests
echo "🧪 Running tests..."
docker run --rm $DOCKER_IMAGE:$DOCKER_TAG python -m pytest test_stac_api.py -v

if [ $? -eq 0 ]; then
    echo "✅ Tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi

# Deploy based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🚀 Deploying to production..."
    
    # Create production environment file
    cat > .env.production << EOF
STAC_CATALOG_ROOT=/app/stac_catalogs
GEOVISION_S3_BUCKET=s3://geovision-ai-miner-data
STAC_API_BASE_URL=https://stac.geovision.ai
AWS_DEFAULT_REGION=us-west-2
ENVIRONMENT=production
EOF

    # Deploy with docker-compose
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.production up -d
    
elif [ "$ENVIRONMENT" = "staging" ]; then
    echo "🧪 Deploying to staging..."
    
    # Create staging environment file
    cat > .env.staging << EOF
STAC_CATALOG_ROOT=/app/stac_catalogs
GEOVISION_S3_BUCKET=s3://geovision-ai-miner-staging
STAC_API_BASE_URL=https://stac-staging.geovision.ai
AWS_DEFAULT_REGION=us-west-2
ENVIRONMENT=staging
EOF

    # Deploy with docker-compose
    docker-compose -f docker-compose.yml --env-file .env.staging up -d
    
else
    echo "🏠 Starting local development environment..."
    docker-compose up -d
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Performing health check..."
if [ "$ENVIRONMENT" = "production" ]; then
    HEALTH_URL="https://stac.geovision.ai/health"
elif [ "$ENVIRONMENT" = "staging" ]; then
    HEALTH_URL="https://stac-staging.geovision.ai/health"
else
    HEALTH_URL="http://localhost:8000/health"
fi

for i in {1..30}; do
    if curl -f -s $HEALTH_URL > /dev/null; then
        echo "✅ Health check passed"
        break
    else
        echo "⏳ Waiting for service to be ready... ($i/30)"
        sleep 2
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Health check failed after 60 seconds"
        exit 1
    fi
done

# Test API endpoints
echo "🔍 Testing API endpoints..."

# Test root catalog
echo "Testing root catalog..."
curl -f -s $HEALTH_URL/../ | jq '.type' | grep -q "Catalog"
if [ $? -eq 0 ]; then
    echo "✅ Root catalog endpoint working"
else
    echo "❌ Root catalog endpoint failed"
fi

# Test collections
echo "Testing collections..."
curl -f -s $HEALTH_URL/../collections | jq '.collections' > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Collections endpoint working"
else
    echo "❌ Collections endpoint failed"
fi

# Test search
echo "Testing search..."
curl -f -s "$HEALTH_URL/../search?limit=1" | jq '.type' | grep -q "FeatureCollection"
if [ $? -eq 0 ]; then
    echo "✅ Search endpoint working"
else
    echo "❌ Search endpoint failed"
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Information:"
echo "  Health Check: $HEALTH_URL"
echo "  API Documentation: ${HEALTH_URL%/health}/docs"
echo "  Root Catalog: ${HEALTH_URL%/health}/"
echo ""

if [ "$ENVIRONMENT" = "local" ]; then
    echo "🔗 Local Development URLs:"
    echo "  STAC API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo "  Redis: localhost:6379"
    echo ""
    echo "📋 Useful commands:"
    echo "  View logs: docker-compose logs -f stac-api"
    echo "  Stop services: docker-compose down"
    echo "  Restart: docker-compose restart stac-api"
fi

echo "✨ STAC API is now live and serving geological data catalogs!"