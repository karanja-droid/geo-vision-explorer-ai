#!/bin/bash

# 🔧 GeoVision AI Miner - Dependency Fix Script
# This script fixes all missing dependencies and configuration issues

set -e

echo "🚀 Starting GeoVision AI Miner dependency fixes..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "Checking current directory: $(pwd)"

# 1. Install missing dependencies
print_status "Installing missing dependencies..."

# Redis client
if ! npm list ioredis >/dev/null 2>&1; then
    print_status "Installing Redis client..."
    npm install ioredis @types/ioredis
    print_success "Redis client installed"
else
    print_success "Redis client already installed"
fi

# Neo4j driver
if ! npm list neo4j-driver >/dev/null 2>&1; then
    print_status "Installing Neo4j driver..."
    npm install neo4j-driver
    print_success "Neo4j driver installed"
else
    print_success "Neo4j driver already installed"
fi

# Graph visualization
if ! npm list vis-network >/dev/null 2>&1; then
    print_status "Installing graph visualization..."
    npm install vis-network @types/vis-network
    print_success "Graph visualization installed"
else
    print_success "Graph visualization already installed"
fi

# Mapbox types
if ! npm list @types/mapbox-gl >/dev/null 2>&1; then
    print_status "Installing Mapbox types..."
    npm install @types/mapbox-gl
    print_success "Mapbox types installed"
else
    print_success "Mapbox types already installed"
fi

# Additional useful dependencies
print_status "Installing additional useful dependencies..."

# Testing framework
if ! npm list vitest >/dev/null 2>&1; then
    npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
    print_success "Testing framework installed"
fi

# Performance monitoring
if ! npm list web-vitals >/dev/null 2>&1; then
    npm install web-vitals
    print_success "Performance monitoring installed"
fi

# 2. Create environment configuration
print_status "Setting up environment configuration..."

if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    cat > .env.local << 'EOF'
# GeoVision AI Miner - Local Environment Configuration

# Supabase Configuration (already configured in client.ts)
VITE_SUPABASE_URL=https://rgtyhffyvpqenrqnkfqc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndHloZmZ5dnBxZW5ycW5rZnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODc4MDYsImV4cCI6MjA2OTk2MzgwNn0.ylzNsFbexxg-IWqmelInLkfN-PydJDzrSRCmnU4HGsE

# Mapbox Configuration (get your token from https://mapbox.com)
VITE_MAPBOX_TOKEN=your_mapbox_token_here

# Redis Configuration (for local development)
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_PASSWORD=
VITE_REDIS_DB=0
VITE_REDIS_CLUSTER=false

# Neo4j Configuration (for local development)
VITE_NEO4J_URI=bolt://localhost:7687
VITE_NEO4J_USERNAME=neo4j
VITE_NEO4J_PASSWORD=password
VITE_NEO4J_DATABASE=geovision

# Development Configuration
VITE_ENVIRONMENT=development
VITE_API_BASE_URL=http://localhost:8080
VITE_LOG_LEVEL=debug

# Feature Flags (for development)
VITE_ENABLE_REDIS=true
VITE_ENABLE_NEO4J=true
VITE_ENABLE_BLAST_ANALYSIS=true
VITE_ENABLE_ADVANCED_ANALYTICS=true
EOF
    print_success "Created .env.local file"
    print_warning "Please update VITE_MAPBOX_TOKEN with your actual Mapbox token"
else
    print_success ".env.local already exists"
fi

# 3. Create .env.example for documentation
if [ ! -f ".env.example" ]; then
    print_status "Creating .env.example file..."
    cat > .env.example << 'EOF'
# GeoVision AI Miner - Environment Configuration Template
# Copy this file to .env.local and update with your actual values

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Mapbox Configuration
VITE_MAPBOX_TOKEN=your_mapbox_token

# Redis Configuration
VITE_REDIS_HOST=localhost
VITE_REDIS_PORT=6379
VITE_REDIS_PASSWORD=
VITE_REDIS_DB=0
VITE_REDIS_CLUSTER=false

# Neo4j Configuration
VITE_NEO4J_URI=bolt://localhost:7687
VITE_NEO4J_USERNAME=neo4j
VITE_NEO4J_PASSWORD=password
VITE_NEO4J_DATABASE=geovision

# Development Configuration
VITE_ENVIRONMENT=development
VITE_API_BASE_URL=http://localhost:8080
VITE_LOG_LEVEL=info

# Feature Flags
VITE_ENABLE_REDIS=true
VITE_ENABLE_NEO4J=true
VITE_ENABLE_BLAST_ANALYSIS=true
VITE_ENABLE_ADVANCED_ANALYTICS=true
EOF
    print_success "Created .env.example file"
fi

# 4. Update package.json scripts if needed
print_status "Checking package.json scripts..."

# Add test script if missing
if ! grep -q '"test"' package.json; then
    print_status "Adding test script to package.json..."
    # This is a simple approach - in production you might want to use jq
    sed -i.bak 's/"preview": "vite preview"/"preview": "vite preview",\n    "test": "vitest",\n    "test:ui": "vitest --ui",\n    "test:coverage": "vitest --coverage"/' package.json
    print_success "Added test scripts"
fi

# 5. Create basic test setup
if [ ! -f "vitest.config.ts" ]; then
    print_status "Creating Vitest configuration..."
    cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
EOF
    print_success "Created Vitest configuration"
fi

# Create test setup file
if [ ! -d "src/test" ]; then
    mkdir -p src/test
fi

if [ ! -f "src/test/setup.ts" ]; then
    print_status "Creating test setup file..."
    cat > src/test/setup.ts << 'EOF'
import '@testing-library/jest-dom'

// Mock environment variables for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_MAPBOX_TOKEN: 'test-token',
    VITE_REDIS_HOST: 'localhost',
    VITE_REDIS_PORT: '6379',
    VITE_NEO4J_URI: 'bolt://localhost:7687',
    VITE_NEO4J_USERNAME: 'neo4j',
    VITE_NEO4J_PASSWORD: 'password',
  },
  writable: true,
})
EOF
    print_success "Created test setup file"
fi

# 6. Create a simple health check script
print_status "Creating health check script..."
cat > check-health.js << 'EOF'
#!/usr/bin/env node

// Simple health check script for GeoVision AI Miner
const http = require('http');

const checkEndpoint = (url, name) => {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      console.log(`✅ ${name}: ${res.statusCode}`);
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log(`⏰ ${name}: Timeout`);
      req.destroy();
      resolve(false);
    });
  });
};

async function healthCheck() {
  console.log('🏥 GeoVision AI Miner Health Check');
  console.log('=====================================');
  
  const checks = [
    { url: 'http://localhost:8080', name: 'Frontend Dev Server' },
    { url: 'http://localhost:6379', name: 'Redis Server' },
    { url: 'http://localhost:7474', name: 'Neo4j Browser' },
  ];
  
  for (const check of checks) {
    await checkEndpoint(check.url, check.name);
  }
  
  console.log('=====================================');
  console.log('Health check complete!');
}

healthCheck();
EOF

chmod +x check-health.js
print_success "Created health check script"

# 7. Create Docker Compose for development services
if [ ! -f "docker-compose.dev.yml" ]; then
    print_status "Creating development Docker Compose file..."
    cat > docker-compose.dev.yml << 'EOF'
# GeoVision AI Miner - Development Services
version: '3.8'

services:
  # Redis for caching and job queues
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Neo4j for graph database
  neo4j:
    image: neo4j:5.15-community
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_dbms_security_procedures_unrestricted=apoc.*
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "password", "RETURN 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL for additional data (if needed)
  postgres:
    image: postgis/postgis:15-3.3
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=geovision_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
  neo4j_data:
  neo4j_logs:
  postgres_data:

networks:
  default:
    name: geovision-dev
EOF
    print_success "Created development Docker Compose file"
fi

# 8. Update .gitignore if needed
if [ -f ".gitignore" ]; then
    if ! grep -q ".env.local" .gitignore; then
        echo "" >> .gitignore
        echo "# Environment files" >> .gitignore
        echo ".env.local" >> .gitignore
        echo ".env.*.local" >> .gitignore
        print_success "Updated .gitignore"
    fi
fi

# 9. Final checks
print_status "Running final checks..."

# Check if all dependencies are installed
if npm list ioredis neo4j-driver vis-network >/dev/null 2>&1; then
    print_success "All required dependencies are installed"
else
    print_warning "Some dependencies may not be properly installed"
fi

# Check if environment file exists
if [ -f ".env.local" ]; then
    print_success "Environment configuration is ready"
else
    print_error "Environment configuration is missing"
fi

print_success "🎉 Dependency fixes completed!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Update your Mapbox token in .env.local"
echo "2. Start development services: docker-compose -f docker-compose.dev.yml up -d"
echo "3. Start the development server: npm run dev"
echo "4. Run health check: node check-health.js"
echo "5. Open http://localhost:8080 in your browser"
echo ""
echo "🔧 Available Commands:"
echo "====================="
echo "npm run dev          # Start development server"
echo "npm run build        # Build for production"
echo "npm run test         # Run tests"
echo "npm run lint         # Run linter"
echo "node check-health.js # Check service health"
echo ""
echo "🐳 Docker Commands:"
echo "=================="
echo "docker-compose -f docker-compose.dev.yml up -d     # Start services"
echo "docker-compose -f docker-compose.dev.yml down      # Stop services"
echo "docker-compose -f docker-compose.dev.yml logs      # View logs"
echo ""
print_success "Setup complete! Happy coding! 🚀"
EOF