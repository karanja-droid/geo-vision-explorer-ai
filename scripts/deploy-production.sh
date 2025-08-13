#!/bin/bash

# GeoVision AI Miner - Production Deployment Script
# Week 3 Implementation - Production Infrastructure Setup

set -euo pipefail

# Configuration
NAMESPACE="geovision-ai-miner"
MONITORING_NAMESPACE="monitoring"
CLUSTER_NAME="geovision-production"
REGION="us-west-2"
ENVIRONMENT="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "helm is not installed"
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi
    
    # Check if we're connected to the right cluster
    CURRENT_CONTEXT=$(kubectl config current-context)
    log "Current kubectl context: $CURRENT_CONTEXT"
    
    read -p "Is this the correct production cluster? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Please switch to the correct cluster context"
    fi
    
    log "Prerequisites check passed"
}

# Create namespaces
create_namespaces() {
    log "Creating namespaces..."
    
    # Create main application namespace
    kubectl apply -f k8s/namespace.yaml
    
    # Create monitoring namespace
    kubectl create namespace $MONITORING_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace $MONITORING_NAMESPACE name=$MONITORING_NAMESPACE --overwrite
    
    # Create security namespace for security tools
    kubectl create namespace security --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace security name=security --overwrite
    
    log "Namespaces created successfully"
}

# Deploy secrets (this should be done securely in production)
deploy_secrets() {
    log "Deploying secrets..."
    
    # Check if secrets already exist
    if kubectl get secret geovision-secrets -n $NAMESPACE &> /dev/null; then
        warn "Secrets already exist. Skipping secret creation."
        return
    fi
    
    # In production, secrets should be managed by external secret management
    # This is a template - replace with actual secret management solution
    warn "IMPORTANT: Update secrets with actual production values before deployment"
    warn "Consider using external secret management like AWS Secrets Manager, HashiCorp Vault, etc."
    
    # Apply secret templates (these need to be updated with real values)
    kubectl apply -f security/secrets.yaml
    
    log "Secrets deployed (remember to update with production values)"
}

# Deploy ConfigMaps
deploy_configmaps() {
    log "Deploying ConfigMaps..."
    
    kubectl apply -f k8s/configmap.yaml
    
    log "ConfigMaps deployed successfully"
}

# Deploy security policies
deploy_security() {
    log "Deploying security policies..."
    
    # Apply Pod Security Standards
    kubectl apply -f security/pod-security-standards.yaml
    
    # Apply Network Policies
    kubectl apply -f security/network-policies.yaml
    
    log "Security policies deployed successfully"
}

# Deploy Redis
deploy_redis() {
    log "Deploying Redis..."
    
    # Create Redis ConfigMap
    kubectl create configmap redis-config \
        --from-file=redis/redis.conf \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Create Redis PVC
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: gp2
EOF
    
    # Deploy Redis from deployment.yaml
    kubectl apply -f k8s/deployment.yaml
    
    # Wait for Redis to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/redis -n $NAMESPACE
    
    log "Redis deployed successfully"
}

# Deploy main application
deploy_application() {
    log "Deploying main application..."
    
    # Apply services first
    kubectl apply -f k8s/service.yaml
    
    # Apply deployments
    kubectl apply -f k8s/deployment.yaml
    
    # Wait for deployments to be ready
    kubectl wait --for=condition=available --timeout=600s deployment/geovision-backend -n $NAMESPACE
    kubectl wait --for=condition=available --timeout=600s deployment/geovision-frontend -n $NAMESPACE
    
    log "Main application deployed successfully"
}

# Deploy ingress
deploy_ingress() {
    log "Deploying ingress..."
    
    # Install NGINX Ingress Controller if not present
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        log "Installing NGINX Ingress Controller..."
        kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
        
        # Wait for ingress controller to be ready
        kubectl wait --namespace ingress-nginx \
            --for=condition=ready pod \
            --selector=app.kubernetes.io/component=controller \
            --timeout=300s
    fi
    
    # Apply ingress configuration
    kubectl apply -f k8s/ingress.yaml
    
    log "Ingress deployed successfully"
}

# Deploy autoscaling
deploy_autoscaling() {
    log "Deploying autoscaling configuration..."
    
    # Install Metrics Server if not present
    if ! kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        log "Installing Metrics Server..."
        kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
        
        # Wait for metrics server to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/metrics-server -n kube-system
    fi
    
    # Apply HPA and VPA configurations
    kubectl apply -f k8s/hpa.yaml
    
    log "Autoscaling deployed successfully"
}

# Deploy monitoring stack
deploy_monitoring() {
    log "Deploying monitoring stack..."
    
    # Add Prometheus Helm repository
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Install Prometheus
    if ! helm list -n $MONITORING_NAMESPACE | grep -q prometheus; then
        log "Installing Prometheus..."
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace $MONITORING_NAMESPACE \
            --create-namespace \
            --values - <<EOF
prometheus:
  prometheusSpec:
    retention: 30d
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp2
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 50Gi
grafana:
  adminPassword: $(openssl rand -base64 32)
  persistence:
    enabled: true
    storageClassName: gp2
    size: 10Gi
alertmanager:
  alertmanagerSpec:
    storage:
      volumeClaimTemplate:
        spec:
          storageClassName: gp2
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 10Gi
EOF
    fi
    
    # Apply custom Prometheus configuration
    kubectl apply -f monitoring/prometheus-config.yaml
    
    # Apply Grafana dashboards
    kubectl apply -f monitoring/grafana-dashboards.yaml
    
    # Apply AlertManager configuration
    kubectl apply -f monitoring/alertmanager-config.yaml
    
    log "Monitoring stack deployed successfully"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check pod status
    log "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check service status
    log "Checking service status..."
    kubectl get services -n $NAMESPACE
    
    # Check ingress status
    log "Checking ingress status..."
    kubectl get ingress -n $NAMESPACE
    
    # Check HPA status
    log "Checking HPA status..."
    kubectl get hpa -n $NAMESPACE
    
    # Run health checks
    log "Running health checks..."
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready --timeout=300s pod -l app=geovision-ai-miner -n $NAMESPACE
    
    # Test backend health endpoint
    BACKEND_POD=$(kubectl get pods -n $NAMESPACE -l component=backend -o jsonpath='{.items[0].metadata.name}')
    if kubectl exec -n $NAMESPACE $BACKEND_POD -- curl -f http://localhost:8080/health; then
        log "Backend health check passed"
    else
        warn "Backend health check failed"
    fi
    
    # Get external IP
    EXTERNAL_IP=$(kubectl get service geovision-loadbalancer -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    log "External IP: $EXTERNAL_IP"
    
    log "Deployment verification completed"
}

# Setup monitoring alerts
setup_monitoring_alerts() {
    log "Setting up monitoring alerts..."
    
    # Get Grafana admin password
    GRAFANA_PASSWORD=$(kubectl get secret --namespace $MONITORING_NAMESPACE prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
    
    log "Grafana admin password: $GRAFANA_PASSWORD"
    log "Access Grafana at: http://<external-ip>/grafana"
    log "Access Prometheus at: http://<external-ip>/prometheus"
    log "Access AlertManager at: http://<external-ip>/alertmanager"
    
    # Create monitoring ingress
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: $MONITORING_NAMESPACE
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: monitoring.geovision-ai-miner.com
    http:
      paths:
      - path: /grafana
        pathType: Prefix
        backend:
          service:
            name: prometheus-grafana
            port:
              number: 80
      - path: /prometheus
        pathType: Prefix
        backend:
          service:
            name: prometheus-kube-prometheus-prometheus
            port:
              number: 9090
      - path: /alertmanager
        pathType: Prefix
        backend:
          service:
            name: prometheus-kube-prometheus-alertmanager
            port:
              number: 9093
EOF
    
    log "Monitoring alerts setup completed"
}

# Cleanup function
cleanup() {
    if [[ $? -ne 0 ]]; then
        error "Deployment failed. Check the logs above for details."
    fi
}

# Main deployment function
main() {
    log "Starting GeoVision AI Miner production deployment..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    create_namespaces
    deploy_secrets
    deploy_configmaps
    deploy_security
    deploy_redis
    deploy_application
    deploy_ingress
    deploy_autoscaling
    deploy_monitoring
    setup_monitoring_alerts
    verify_deployment
    
    log "🎉 GeoVision AI Miner production deployment completed successfully!"
    log ""
    log "Next steps:"
    log "1. Update DNS records to point to the external IP: $EXTERNAL_IP"
    log "2. Configure SSL certificates (Let's Encrypt or custom)"
    log "3. Update secrets with production values"
    log "4. Configure monitoring alerts and notifications"
    log "5. Run security scans and penetration testing"
    log "6. Set up backup and disaster recovery procedures"
    log ""
    log "Access URLs:"
    log "- Application: https://geovision-ai-miner.com"
    log "- Monitoring: https://monitoring.geovision-ai-miner.com"
    log "- Grafana: https://monitoring.geovision-ai-miner.com/grafana (admin/$GRAFANA_PASSWORD)"
}

# Run main function
main "$@"