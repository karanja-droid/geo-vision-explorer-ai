# 🚀 GeoMiner AWS Deployment Guide

## Overview

This guide covers deploying the GeoMiner AI Geological Intelligence platform to AWS using multiple deployment strategies. The application consists of a React frontend, Supabase backend, and various microservices.

## 📋 Prerequisites

### AWS Account Setup
- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Domain name registered (geo-miner.com)
- SSL certificate (AWS Certificate Manager)

### Required AWS Services
- **EKS (Elastic Kubernetes Service)** - Container orchestration
- **RDS (PostgreSQL with PostGIS)** - Primary database
- **ElastiCache (Redis)** - Caching layer
- **S3** - Static assets and file storage
- **CloudFront** - CDN for global distribution
- **Route 53** - DNS management
- **Certificate Manager** - SSL/TLS certificates
- **Application Load Balancer** - Load balancing
- **ECR** - Container registry
- **CloudWatch** - Monitoring and logging
- **Secrets Manager** - Secure credential storage

## 🏗️ Deployment Options

### Option 1: AWS EKS (Recommended for Production)
Full Kubernetes deployment with auto-scaling and high availability.

### Option 2: AWS ECS with Fargate
Serverless container deployment with managed infrastructure.

### Option 3: AWS Amplify + Lambda
Serverless deployment for frontend with Lambda functions.

### Option 4: EC2 with Docker Compose
Traditional VM-based deployment for development/testing.

---

## 🎯 Option 1: AWS EKS Deployment (Production Ready)

### Step 1: Create EKS Cluster

```bash
# Install eksctl
curl --silent --location \"https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz\" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create EKS cluster
eksctl create cluster \\
  --name geominer-production \\
  --region us-west-2 \\
  --version 1.28 \\
  --nodegroup-name geominer-nodes \\
  --node-type m5.large \\
  --nodes 3 \\
  --nodes-min 2 \\
  --nodes-max 10 \\
  --managed \\
  --with-oidc \\
  --ssh-access \\
  --ssh-public-key ~/.ssh/id_rsa.pub \\
  --full-ecr-access
```

### Step 2: Install Required Add-ons

```bash
# AWS Load Balancer Controller
eksctl create iamserviceaccount \\
  --cluster=geominer-production \\
  --namespace=kube-system \\
  --name=aws-load-balancer-controller \\
  --role-name AmazonEKSLoadBalancerControllerRole \\
  --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \\
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \\
  -n kube-system \\
  --set clusterName=geominer-production \\
  --set serviceAccount.create=false \\
  --set serviceAccount.name=aws-load-balancer-controller

# EBS CSI Driver
eksctl create iamserviceaccount \\
  --name ebs-csi-controller-sa \\
  --namespace kube-system \\
  --cluster geominer-production \\
  --role-name AmazonEKS_EBS_CSI_DriverRole \\
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \\
  --approve

eksctl create addon --name aws-ebs-csi-driver --cluster geominer-production --service-account-role-arn arn:aws:iam::ACCOUNT-ID:role/AmazonEKS_EBS_CSI_DriverRole --force

# Cluster Autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
kubectl -n kube-system annotate deployment.apps/cluster-autoscaler cluster-autoscaler.kubernetes.io/safe-to-evict=\"false\"
kubectl -n kube-system edit deployment.apps/cluster-autoscaler
```

### Step 3: Create AWS Resources

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \\
  --db-instance-identifier geominer-postgres \\
  --db-instance-class db.r5.xlarge \\
  --engine postgres \\
  --engine-version 15.4 \\
  --master-username geominer \\
  --master-user-password 'YourSecurePassword123!' \\
  --allocated-storage 100 \\
  --storage-type gp2 \\
  --storage-encrypted \\
  --vpc-security-group-ids sg-xxxxxxxxx \\
  --db-subnet-group-name geominer-db-subnet-group \\
  --backup-retention-period 7 \\
  --multi-az \\
  --publicly-accessible false

# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \\
  --cache-cluster-id geominer-redis \\
  --cache-node-type cache.r5.large \\
  --engine redis \\
  --num-cache-nodes 1 \\
  --cache-parameter-group default.redis7 \\
  --cache-subnet-group-name geominer-cache-subnet-group \\
  --security-group-ids sg-xxxxxxxxx

# Create S3 buckets
aws s3 mb s3://geominer-assets-prod
aws s3 mb s3://geominer-backups-prod
aws s3 mb s3://geominer-logs-prod

# Configure S3 bucket policies
aws s3api put-bucket-policy --bucket geominer-assets-prod --policy file://s3-bucket-policy.json
```

### Step 4: Build and Push Docker Images

```bash
# Create ECR repositories
aws ecr create-repository --repository-name geominer/frontend
aws ecr create-repository --repository-name geominer/backend

# Get ECR login token
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com

# Build and push frontend
docker build -t geominer/frontend .
docker tag geominer/frontend:latest ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/frontend:latest
docker push ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/frontend:latest

# Build and push backend (if you have a separate backend)
docker build -f Dockerfile.backend -t geominer/backend .
docker tag geominer/backend:latest ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/backend:latest
docker push ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/backend:latest
```

### Step 5: Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace geominer

# Create secrets from AWS Secrets Manager
kubectl create secret generic geominer-secrets \\
  --from-literal=DATABASE_URL=\"postgresql://geominer:password@geominer-postgres.region.rds.amazonaws.com:5432/geominer\" \\
  --from-literal=REDIS_URL=\"redis://geominer-redis.cache.amazonaws.com:6379\" \\
  --from-literal=SUPABASE_URL=\"https://your-project.supabase.co\" \\
  --from-literal=SUPABASE_ANON_KEY=\"your-anon-key\" \\
  --from-literal=SUPABASE_SERVICE_ROLE_KEY=\"your-service-role-key\" \\
  --from-literal=MAPBOX_ACCESS_TOKEN=\"your-mapbox-token\" \\
  --namespace geominer
```

### Step 6: Deploy Application

```bash
# Update image references in deployment files
sed -i 's|geovision-ai-miner/frontend:latest|ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/frontend:latest|g' k8s/deployment.yaml

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Wait for deployment
kubectl wait --for=condition=available --timeout=600s deployment/geominer-frontend -n geominer
```

### Step 7: Configure DNS and SSL

```bash
# Get ALB DNS name
ALB_DNS=$(kubectl get ingress geominer-alb-ingress -n geominer -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Create Route 53 records
aws route53 change-resource-record-sets --hosted-zone-id Z123456789 --change-batch '{
  \"Changes\": [{
    \"Action\": \"CREATE\",
    \"ResourceRecordSet\": {
      \"Name\": \"geo-miner.com\",
      \"Type\": \"A\",
      \"AliasTarget\": {
        \"DNSName\": \"'$ALB_DNS'\",
        \"EvaluateTargetHealth\": false,
        \"HostedZoneId\": \"Z215JYRZR1TBD5\"
      }
    }
  }]
}'
```

---

## 🎯 Option 2: AWS ECS with Fargate

### Step 1: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name geominer-fargate --capacity-providers FARGATE --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1

# Create task execution role
aws iam create-role --role-name ecsTaskExecutionRole --assume-role-policy-document file://ecs-task-execution-role.json
aws iam attach-role-policy --role-name ecsTaskExecutionRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Step 2: Create Task Definition

```json
{
  \"family\": \"geominer-frontend\",
  \"networkMode\": \"awsvpc\",
  \"requiresCompatibilities\": [\"FARGATE\"],
  \"cpu\": \"512\",
  \"memory\": \"1024\",
  \"executionRoleArn\": \"arn:aws:iam::ACCOUNT-ID:role/ecsTaskExecutionRole\",
  \"containerDefinitions\": [
    {
      \"name\": \"geominer-frontend\",
      \"image\": \"ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/geominer/frontend:latest\",
      \"portMappings\": [
        {
          \"containerPort\": 80,
          \"protocol\": \"tcp\"
        }
      ],
      \"essential\": true,
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/geominer-frontend\",
          \"awslogs-region\": \"us-west-2\",
          \"awslogs-stream-prefix\": \"ecs\"
        }
      },
      \"environment\": [
        {
          \"name\": \"NODE_ENV\",
          \"value\": \"production\"
        }
      ],
      \"secrets\": [
        {
          \"name\": \"SUPABASE_URL\",
          \"valueFrom\": \"arn:aws:secretsmanager:us-west-2:ACCOUNT-ID:secret:geominer/supabase-url\"
        }
      ]
    }
  ]
}
```

### Step 3: Create ECS Service

```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://geominer-task-definition.json

# Create service
aws ecs create-service \\
  --cluster geominer-fargate \\
  --service-name geominer-frontend-service \\
  --task-definition geominer-frontend:1 \\
  --desired-count 2 \\
  --launch-type FARGATE \\
  --network-configuration \"awsvpcConfiguration={subnets=[subnet-12345,subnet-67890],securityGroups=[sg-abcdef],assignPublicIp=ENABLED}\" \\
  --load-balancers \"targetGroupArn=arn:aws:elasticloadbalancing:us-west-2:ACCOUNT-ID:targetgroup/geominer-tg/1234567890123456,containerName=geominer-frontend,containerPort=80\"
```

---

## 🎯 Option 3: AWS Amplify + Lambda (Serverless)

### Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
amplify configure
```

### Step 2: Initialize Amplify Project

```bash
amplify init
# Follow prompts:
# - Project name: geominer
# - Environment: prod
# - Default editor: Visual Studio Code
# - App type: javascript
# - Framework: react
# - Source directory: src
# - Build directory: dist
# - Build command: npm run build
# - Start command: npm run dev
```

### Step 3: Add Hosting

```bash
amplify add hosting
# Choose: Amazon CloudFront and S3
# Select: PROD (S3 with CloudFront using HTTPS)

amplify publish
```

### Step 4: Add API (if needed)

```bash
amplify add api
# Choose: REST
# Provide friendly name: geominerapi
# Provide path: /api
# Create Lambda function: Yes
# Function name: geominerFunction
# Choose template: Serverless ExpressJS function
```

---

## 🎯 Option 4: EC2 with Docker Compose (Development)

### Step 1: Launch EC2 Instance

```bash
# Launch EC2 instance
aws ec2 run-instances \\
  --image-id ami-0c02fb55956c7d316 \\
  --count 1 \\
  --instance-type t3.large \\
  --key-name your-key-pair \\
  --security-group-ids sg-xxxxxxxxx \\
  --subnet-id subnet-xxxxxxxxx \\
  --user-data file://user-data.sh
```

### Step 2: User Data Script

```bash
#!/bin/bash
yum update -y
yum install -y docker git

# Install Docker Compose
curl -L \"https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)\" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Clone repository
git clone https://github.com/your-org/geominer.git /home/ec2-user/geominer
cd /home/ec2-user/geominer

# Start application
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔧 Required Dockerfiles

### Frontend Dockerfile

```dockerfile
# Frontend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD [\"nginx\", \"-g\", \"daemon off;\"]
```

### Backend Dockerfile (if separate)

```dockerfile
# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8080
CMD [\"npm\", \"start\"]
```

---

## 🔐 Security Configuration

### IAM Roles and Policies

```json
{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [
        \"s3:GetObject\",
        \"s3:PutObject\",
        \"s3:DeleteObject\"
      ],
      \"Resource\": \"arn:aws:s3:::geominer-assets-prod/*\"
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [
        \"rds:DescribeDBInstances\",
        \"rds:Connect\"
      ],
      \"Resource\": \"*\"
    }
  ]
}
```

### Security Groups

```bash
# Web tier security group
aws ec2 create-security-group \\
  --group-name geominer-web-sg \\
  --description \"Security group for GeoMiner web tier\"

aws ec2 authorize-security-group-ingress \\
  --group-id sg-xxxxxxxxx \\
  --protocol tcp \\
  --port 80 \\
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \\
  --group-id sg-xxxxxxxxx \\
  --protocol tcp \\
  --port 443 \\
  --cidr 0.0.0.0/0

# Database security group
aws ec2 create-security-group \\
  --group-name geominer-db-sg \\
  --description \"Security group for GeoMiner database\"

aws ec2 authorize-security-group-ingress \\
  --group-id sg-yyyyyyyyy \\
  --protocol tcp \\
  --port 5432 \\
  --source-group sg-xxxxxxxxx
```

---

## 📊 Monitoring and Logging

### CloudWatch Configuration

```bash
# Create log groups
aws logs create-log-group --log-group-name /aws/eks/geominer/application
aws logs create-log-group --log-group-name /aws/rds/geominer/postgresql

# Create CloudWatch dashboard
aws cloudwatch put-dashboard --dashboard-name GeoMiner --dashboard-body file://cloudwatch-dashboard.json
```

### Prometheus and Grafana (EKS)

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \\
  --namespace monitoring \\
  --create-namespace \\
  --set grafana.adminPassword=admin123

# Port forward to access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

---

## 🚀 Deployment Scripts

### Automated Deployment Script

```bash
#!/bin/bash
# deploy-to-aws.sh

set -e

ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-west-2}
CLUSTER_NAME=\"geominer-${ENVIRONMENT}\"

echo \"🚀 Deploying GeoMiner to AWS EKS...\"

# Build and push images
echo \"📦 Building and pushing Docker images...\"
./scripts/build-and-push.sh $AWS_REGION

# Update kubeconfig
echo \"🔧 Updating kubeconfig...\"
aws eks update-kubeconfig --region $AWS_REGION --name $CLUSTER_NAME

# Deploy to Kubernetes
echo \"☸️ Deploying to Kubernetes...\"
kubectl apply -f k8s/

# Wait for deployment
echo \"⏳ Waiting for deployment to complete...\"
kubectl wait --for=condition=available --timeout=600s deployment/geominer-frontend -n geominer

# Get load balancer URL
echo \"🌐 Getting application URL...\"
ALB_URL=$(kubectl get ingress geominer-alb-ingress -n geominer -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo \"Application available at: https://$ALB_URL\"

echo \"✅ Deployment completed successfully!\"
```

---

## 💰 Cost Optimization

### Resource Sizing Recommendations

| Component | Development | Production |
|-----------|-------------|------------|
| EKS Nodes | t3.medium (2 nodes) | m5.large (3-10 nodes) |
| RDS | db.t3.micro | db.r5.xlarge |
| ElastiCache | cache.t3.micro | cache.r5.large |
| ALB | 1 ALB | 1 ALB + WAF |

### Cost Monitoring

```bash
# Set up cost alerts
aws budgets create-budget --account-id ACCOUNT-ID --budget '{
  \"BudgetName\": \"GeoMiner-Monthly-Budget\",
  \"BudgetLimit\": {
    \"Amount\": \"500\",
    \"Unit\": \"USD\"
  },
  \"TimeUnit\": \"MONTHLY\",
  \"BudgetType\": \"COST\"
}'
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: Deploy to AWS
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Build and push to ECR
      run: |
        aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $ECR_REGISTRY
        docker build -t $ECR_REGISTRY/geominer/frontend:$GITHUB_SHA .
        docker push $ECR_REGISTRY/geominer/frontend:$GITHUB_SHA
    
    - name: Deploy to EKS
      run: |
        aws eks update-kubeconfig --region us-west-2 --name geominer-production
        sed -i 's|IMAGE_TAG|'$GITHUB_SHA'|g' k8s/deployment.yaml
        kubectl apply -f k8s/
```

---

## 🆘 Troubleshooting

### Common Issues

1. **EKS Cluster Creation Fails**
   ```bash
   # Check CloudFormation stack
   aws cloudformation describe-stacks --stack-name eksctl-geominer-production-cluster
   ```

2. **Pods Not Starting**
   ```bash
   kubectl describe pod <pod-name> -n geominer
   kubectl logs <pod-name> -n geominer
   ```

3. **Load Balancer Not Accessible**
   ```bash
   kubectl get ingress -n geominer
   kubectl describe ingress geominer-alb-ingress -n geominer
   ```

4. **Database Connection Issues**
   ```bash
   # Test from pod
   kubectl exec -it <pod-name> -n geominer -- psql $DATABASE_URL
   ```

---

## 📋 Post-Deployment Checklist

- [ ] Application accessible via domain
- [ ] SSL certificate working
- [ ] Database connections working
- [ ] Redis cache working
- [ ] Monitoring dashboards accessible
- [ ] Log aggregation working
- [ ] Backup procedures tested
- [ ] Auto-scaling configured
- [ ] Security groups properly configured
- [ ] Cost monitoring alerts set up

---

## 📞 Support

For deployment issues:
1. Check CloudWatch logs
2. Review Kubernetes events
3. Verify security group rules
4. Test database connectivity
5. Check resource quotas

**Estimated Deployment Time:** 2-4 hours for EKS, 1-2 hours for ECS/Fargate

**Monthly Cost Estimate:** $200-800 depending on usage and instance sizes.

This guide provides multiple deployment options to suit different needs and budgets. Choose the option that best fits your requirements and scale as needed.