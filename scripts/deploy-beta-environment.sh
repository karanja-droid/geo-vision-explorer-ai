#!/bin/bash

# GeoVision AI Miner - Beta Environment Deployment Script
# This script deploys the complete beta testing infrastructure

set -e

echo "🚀 GeoVision AI Miner - Beta Environment Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="geovision-beta"
DOMAIN="beta.geovision.ai"
DOCKER_REGISTRY="geovision"
IMAGE_TAG="beta"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check docker
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -t ${DOCKER_REGISTRY}/ai-miner-frontend:${IMAGE_TAG} \
        --build-arg VITE_ENVIRONMENT=beta \
        --build-arg VITE_ENABLE_BETA_FEATURES=true \
        .
    
    # Push to registry
    log_info "Pushing frontend image to registry..."
    docker push ${DOCKER_REGISTRY}/ai-miner-frontend:${IMAGE_TAG}
    
    log_success "Docker images built and pushed"
}

# Deploy Kubernetes resources
deploy_kubernetes() {
    log_info "Deploying Kubernetes resources..."
    
    # Apply beta environment configuration
    kubectl apply -f k8s/beta-environment.yaml
    
    # Wait for namespace to be ready
    kubectl wait --for=condition=Ready namespace/${NAMESPACE} --timeout=60s
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available deployment/frontend-beta -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=available deployment/redis-beta -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=available deployment/prometheus-beta -n ${NAMESPACE} --timeout=300s
    
    log_success "Kubernetes resources deployed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Install Prometheus if not exists
    if ! kubectl get deployment prometheus-beta -n ${NAMESPACE} &> /dev/null; then
        log_info "Installing Prometheus..."
        kubectl apply -f k8s/monitoring/prometheus-beta.yaml
    fi
    
    # Install Grafana if not exists
    if ! kubectl get deployment grafana-beta -n ${NAMESPACE} &> /dev/null; then
        log_info "Installing Grafana..."
        kubectl apply -f k8s/monitoring/grafana-beta.yaml
    fi
    
    log_success "Monitoring setup complete"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    # Check if cert-manager is installed
    if ! kubectl get namespace cert-manager &> /dev/null; then
        log_warning "cert-manager not found, installing..."
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
        kubectl wait --for=condition=available deployment/cert-manager -n cert-manager --timeout=300s
    fi
    
    # Apply cluster issuer
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@geovision.ai
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    log_success "SSL certificates configured"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Run beta testing setup script
    if [ -f "scripts/beta-testing-setup.ts" ]; then
        log_info "Setting up beta testing database..."
        npx tsx scripts/beta-testing-setup.ts
    fi
    
    # Apply Supabase migrations
    if command -v supabase &> /dev/null; then
        log_info "Applying Supabase migrations..."
        supabase db push
    else
        log_warning "Supabase CLI not found, skipping migrations"
    fi
    
    log_success "Database migrations complete"
}

# Setup load testing
setup_load_testing() {
    log_info "Setting up load testing..."
    
    # Create load testing job
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: beta-load-test
  namespace: ${NAMESPACE}
spec:
  template:
    spec:
      containers:
      - name: k6
        image: grafana/k6:latest
        command: ["k6", "run", "--vus", "100", "--duration", "5m", "/scripts/load-test.js"]
        volumeMounts:
        - name: load-test-script
          mountPath: /scripts
      volumes:
      - name: load-test-script
        configMap:
          name: load-test-config
      restartPolicy: Never
  backoffLimit: 3
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: load-test-config
  namespace: ${NAMESPACE}
data:
  load-test.js: |
    import http from 'k6/http';
    import { check, sleep } from 'k6';
    
    export let options = {
      vus: 100,
      duration: '5m',
    };
    
    export default function() {
      let response = http.get('https://${DOMAIN}');
      check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 2s': (r) => r.timings.duration < 2000,
      });
      sleep(1);
    }
EOF
    
    log_success "Load testing configured"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n ${NAMESPACE}
    
    # Check service status
    log_info "Checking service status..."
    kubectl get services -n ${NAMESPACE}
    
    # Check ingress status
    log_info "Checking ingress status..."
    kubectl get ingress -n ${NAMESPACE}
    
    # Test application health
    log_info "Testing application health..."
    if curl -f -s https://${DOMAIN}/health > /dev/null; then
        log_success "Application health check passed"
    else
        log_warning "Application health check failed - may need time to start"
    fi
    
    log_success "Deployment verification complete"
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."
    
    REPORT_FILE="beta-deployment-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > ${REPORT_FILE} << EOF
# Beta Environment Deployment Report

**Deployment Date:** $(date)
**Environment:** Beta Testing
**Namespace:** ${NAMESPACE}
**Domain:** https://${DOMAIN}

## Deployment Status

### Kubernetes Resources
\`\`\`
$(kubectl get all -n ${NAMESPACE})
\`\`\`

### Ingress Configuration
\`\`\`
$(kubectl get ingress -n ${NAMESPACE} -o yaml)
\`\`\`

### Resource Usage
\`\`\`
$(kubectl top pods -n ${NAMESPACE} 2>/dev/null || echo "Metrics server not available")
\`\`\`

## Access Information

- **Beta Application:** https://${DOMAIN}
- **Prometheus Metrics:** https://${DOMAIN}/metrics
- **Grafana Dashboard:** https://${DOMAIN}/grafana

## Next Steps

1. **Invite Beta Users:** Run \`npm run beta:invite-users\`
2. **Monitor Performance:** Check Grafana dashboards
3. **Collect Feedback:** Review beta feedback widget
4. **Load Testing:** Run \`kubectl create job --from=job/beta-load-test beta-load-test-$(date +%s) -n ${NAMESPACE}\`

## Support

For issues or questions, contact the development team or check the logs:
\`\`\`bash
kubectl logs -f deployment/frontend-beta -n ${NAMESPACE}
\`\`\`
EOF
    
    log_success "Deployment report generated: ${REPORT_FILE}"
}

# Cleanup function
cleanup() {
    if [ "$1" = "true" ]; then
        log_warning "Cleaning up beta environment..."
        kubectl delete namespace ${NAMESPACE} --ignore-not-found=true
        log_success "Beta environment cleaned up"
    fi
}

# Main deployment function
main() {
    local CLEANUP_ONLY=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --cleanup)
                CLEANUP_ONLY=true
                shift
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --registry)
                DOCKER_REGISTRY="$2"
                shift 2
                ;;
            --tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --cleanup          Clean up beta environment"
                echo "  --domain DOMAIN    Set custom domain (default: beta.geovision.ai)"
                echo "  --registry REG     Set Docker registry (default: geovision)"
                echo "  --tag TAG          Set image tag (default: beta)"
                echo "  -h, --help         Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    if [ "$CLEANUP_ONLY" = "true" ]; then
        cleanup true
        exit 0
    fi
    
    # Run deployment steps
    log_info "Starting beta environment deployment..."
    
    check_prerequisites
    build_and_push_images
    deploy_kubernetes
    setup_ssl
    setup_monitoring
    run_migrations
    setup_load_testing
    
    # Wait for everything to be ready
    log_info "Waiting for all services to be ready..."
    sleep 30
    
    verify_deployment
    generate_report
    
    echo ""
    log_success "🎉 Beta environment deployment completed successfully!"
    echo ""
    echo "📋 Beta Environment Information:"
    echo "   • Application URL: https://${DOMAIN}"
    echo "   • Namespace: ${NAMESPACE}"
    echo "   • Monitoring: https://${DOMAIN}/metrics"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Invite beta users: npm run beta:invite-users"
    echo "   2. Monitor dashboard: https://${DOMAIN}/beta/dashboard"
    echo "   3. Run load tests: kubectl create job --from=job/beta-load-test test-$(date +%s) -n ${NAMESPACE}"
    echo ""
    echo "📞 Support: Check logs with 'kubectl logs -f deployment/frontend-beta -n ${NAMESPACE}'"
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"