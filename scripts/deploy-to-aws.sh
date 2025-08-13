#!/bin/bash

# GeoMiner AWS Deployment Script
# Usage: ./scripts/deploy-to-aws.sh [environment] [region]

set -e

ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-west-2}
CLUSTER_NAME="geominer-${ENVIRONMENT}"
NAMESPACE="geominer"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check if AWS CLI is installed and configured
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured"
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        warn "Helm is not installed - some features may not work"
    fi
    
    log "✅ Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    log "🏗️ Building and pushing Docker images..."
    
    if [ -f "scripts/build-and-push.sh" ]; then
        ./scripts/build-and-push.sh $AWS_REGION latest
    else
        error "build-and-push.sh script not found"
    fi
    
    log "✅ Images built and pushed successfully"
}

# Update kubeconfig
update_kubeconfig() {
    log "🔧 Updating kubeconfig for cluster: $CLUSTER_NAME"
    
    if ! aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME; then
        error "Failed to update kubeconfig. Make sure the EKS cluster exists."
    fi
    
    # Verify connection
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    log "✅ Kubeconfig updated successfully"
}

# Create namespace if it doesn't exist
create_namespace() {
    log "📁 Creating namespace: $NAMESPACE"
    
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace $NAMESPACE name=$NAMESPACE --overwrite
    
    log "✅ Namespace ready"
}

# Deploy secrets
deploy_secrets() {
    log "🔐 Deploying secrets..."
    
    # Check if secrets already exist
    if kubectl get secret geominer-secrets -n $NAMESPACE &> /dev/null; then
        warn "Secrets already exist. Skipping secret creation."
        return
    fi
    
    # Create secrets from environment variables or AWS Secrets Manager
    if [ -f ".env.production" ]; then
        log "Creating secrets from .env.production file..."
        kubectl create secret generic geominer-secrets \
            --from-env-file=.env.production \
            --namespace=$NAMESPACE
    else
        warn "No .env.production file found. Please create secrets manually:"
        info "kubectl create secret generic geominer-secrets \\"
        info "  --from-literal=SUPABASE_URL=your-supabase-url \\"
        info "  --from-literal=SUPABASE_ANON_KEY=your-anon-key \\"
        info "  --from-literal=MAPBOX_ACCESS_TOKEN=your-mapbox-token \\"
        info "  --namespace=$NAMESPACE"
    fi
    
    log "✅ Secrets deployed"
}

# Deploy ConfigMaps
deploy_configmaps() {
    log "📋 Deploying ConfigMaps..."
    
    if [ -f "k8s/configmap.yaml" ]; then
        kubectl apply -f k8s/configmap.yaml
    else
        warn "No configmap.yaml found, skipping ConfigMap deployment"
    fi
    
    log "✅ ConfigMaps deployed"
}

# Deploy application
deploy_application() {
    log "🚀 Deploying application..."
    
    # Apply all Kubernetes manifests
    if [ -d "k8s" ]; then
        kubectl apply -f k8s/ --recursive
    else
        error "k8s directory not found"
    fi
    
    # Wait for deployments to be ready
    log "⏳ Waiting for deployments to be ready..."
    
    if kubectl get deployment geominer-frontend -n $NAMESPACE &> /dev/null; then
        kubectl wait --for=condition=available --timeout=600s deployment/geominer-frontend -n $NAMESPACE
    fi
    
    if kubectl get deployment geominer-backend -n $NAMESPACE &> /dev/null; then
        kubectl wait --for=condition=available --timeout=600s deployment/geominer-backend -n $NAMESPACE
    fi
    
    log "✅ Application deployed successfully"
}

# Verify deployment
verify_deployment() {
    log "🔍 Verifying deployment..."
    
    # Check pod status
    log "Pod status:"
    kubectl get pods -n $NAMESPACE
    
    # Check service status
    log "Service status:"
    kubectl get services -n $NAMESPACE
    
    # Check ingress status
    log "Ingress status:"
    kubectl get ingress -n $NAMESPACE
    
    # Get application URL
    if kubectl get ingress -n $NAMESPACE &> /dev/null; then
        ALB_URL=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Pending")
        if [ "$ALB_URL" != "Pending" ] && [ -n "$ALB_URL" ]; then
            log "🌐 Application URL: https://$ALB_URL"
        else
            warn "Load balancer URL not yet available. Check ingress status."
        fi
    fi
    
    # Run health checks
    log "🏥 Running health checks..."
    
    # Wait for all pods to be ready
    if ! kubectl wait --for=condition=ready --timeout=300s pod -l app=geominer -n $NAMESPACE; then
        warn "Some pods are not ready yet"
    fi
    
    log "✅ Deployment verification completed"
}

# Setup monitoring (optional)
setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    if command -v helm &> /dev/null; then
        # Add Prometheus Helm repository
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        # Install Prometheus if not already installed
        if ! helm list -n monitoring | grep -q prometheus; then
            log "Installing Prometheus monitoring stack..."
            kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
            
            helm install prometheus prometheus-community/kube-prometheus-stack \
                --namespace monitoring \
                --set grafana.adminPassword=admin123 \
                --set prometheus.prometheusSpec.retention=30d \
                --timeout 10m
        else
            log "Prometheus already installed"
        fi
    else
        warn "Helm not available, skipping monitoring setup"
    fi
    
    log "✅ Monitoring setup completed"
}

# Cleanup function
cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed. Check the logs above for details."
        log "🔧 Troubleshooting tips:"
        log "1. Check pod logs: kubectl logs -l app=geominer -n $NAMESPACE"
        log "2. Describe pods: kubectl describe pods -n $NAMESPACE"
        log "3. Check events: kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
    fi
}

# Main deployment function
main() {
    log "🚀 Starting GeoMiner deployment to AWS..."
    log "Environment: $ENVIRONMENT"
    log "Region: $AWS_REGION"
    log "Cluster: $CLUSTER_NAME"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    build_and_push_images
    update_kubeconfig
    create_namespace
    deploy_secrets
    deploy_configmaps
    deploy_application
    verify_deployment
    
    # Optional monitoring setup
    read -p "Do you want to set up monitoring? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_monitoring
    fi
    
    log "🎉 GeoMiner deployment completed successfully!"
    log ""
    log "📋 Next steps:"
    log "1. Configure DNS to point to the load balancer"
    log "2. Set up SSL certificates if not using AWS Certificate Manager"
    log "3. Configure monitoring alerts"
    log "4. Set up backup procedures"
    log "5. Run security scans"
    log ""
    log "🔗 Useful commands:"
    log "- View pods: kubectl get pods -n $NAMESPACE"
    log "- View logs: kubectl logs -f deployment/geominer-frontend -n $NAMESPACE"
    log "- Scale deployment: kubectl scale deployment geominer-frontend --replicas=5 -n $NAMESPACE"
    log "- Port forward: kubectl port-forward svc/geominer-frontend 8080:80 -n $NAMESPACE"
    
    if command -v helm &> /dev/null && helm list -n monitoring | grep -q prometheus; then
        log "- Access Grafana: kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring"
        log "  (Username: admin, Password: admin123)"
    fi
}

# Run main function
main "$@"