# 🌍 GeoVision AI Miner - FastAPI STAC Server

A high-performance, production-ready STAC (SpatioTemporal Asset Catalog) API server specifically designed for geological and geophysical datasets.

## 🎯 Features

### **STAC Compliance**
- Full STAC 1.0.0 specification compliance
- Standard STAC API endpoints (`/`, `/collections`, `/search`)
- GeoJSON FeatureCollection responses
- Proper STAC links and metadata

### **Geological Extensions**
- Custom geological metadata support
- Mineral-specific search endpoints
- Data type filtering (spectral, hyperspectral, magnetic, gravity)
- Geological confidence scoring and quality metrics

### **Performance Optimizations**
- In-memory caching for catalogs and collections
- Async/await throughout for non-blocking operations
- Redis integration for distributed caching
- Efficient spatial and temporal filtering

### **Production Ready**
- Docker containerization with multi-stage builds
- Nginx reverse proxy with rate limiting
- Health checks and monitoring endpoints
- CORS support for frontend integration
- Comprehensive test suite

## 🚀 Quick Start

### **Local Development**
```bash
# Clone and setup
git clone <repository>
cd api/

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn stac_server:app --reload --host 0.0.0.0 --port 8000

# Or use Docker Compose
docker-compose up -d
```

### **Production Deployment**
```bash
# Deploy to production
./deploy_stac_api.sh production

# Or deploy to staging
ENVIRONMENT=staging ./deploy_stac_api.sh staging
```

## 📋 API Endpoints

### **Core STAC Endpoints**

#### **Root Catalog**
```http
GET /
```
Returns the root STAC catalog with links to collections and search.

#### **Collections**
```http
GET /collections
```
List all available STAC collections.

```http
GET /collections/{collection_id}
```
Get a specific collection by ID.

#### **Items**
```http
GET /collections/{collection_id}/items
```
Get items from a specific collection.

```http
GET /collections/{collection_id}/items/{item_id}
```
Get a specific item by ID.

#### **Search**
```http
GET /search?bbox={bbox}&datetime={datetime}&collections={collections}&limit={limit}
POST /search
```
Search for items across collections with spatial, temporal, and attribute filters.

### **Geological Extensions**

#### **Mineral Search**
```http
GET /geological/minerals/{mineral}?limit={limit}
```
Search for geological data by target mineral (gold, copper, iron, etc.).

#### **Data Type Search**
```http
GET /geological/data-types/{data_type}?limit={limit}
```
Search by geological data type (spectral, hyperspectral, magnetic, gravity).

### **Utility Endpoints**

#### **Health Check**
```http
GET /health
```
Returns service health status and version information.

## 🔧 Configuration

### **Environment Variables**
```bash
# Required
STAC_CATALOG_ROOT=/path/to/stac/catalogs
GEOVISION_S3_BUCKET=s3://your-bucket-name
STAC_API_BASE_URL=https://your-domain.com

# Optional
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-west-2
REDIS_URL=redis://localhost:6379
```

### **Docker Configuration**
```yaml
# docker-compose.yml
services:
  stac-api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - STAC_CATALOG_ROOT=/app/stac_catalogs
      - GEOVISION_S3_BUCKET=s3://geovision-ai-miner-data
    volumes:
      - ./stac_catalogs:/app/stac_catalogs:ro
```

## 📊 Example Requests

### **Search for Gold Deposits**
```bash
curl "https://stac.geovision.ai/geological/minerals/gold?limit=10"
```

### **Search by Bounding Box**
```bash
curl "https://stac.geovision.ai/search?bbox=-180,-90,180,90&limit=5"
```

### **Search with POST Body**
```bash
curl -X POST "https://stac.geovision.ai/search" \
  -H "Content-Type: application/json" \
  -d '{
    "bbox": [-180, -90, 180, 90],
    "datetime": "2024-01-01/2024-12-31",
    "collections": ["spectral-landsat8-zmb"],
    "query": {
      "geological:confidence": {"gte": 0.8}
    },
    "limit": 10
  }'
```

### **Get Hyperspectral Data**
```bash
curl "https://stac.geovision.ai/geological/data-types/hyperspectral"
```

## 🏗️ Architecture

### **Components**
- **FastAPI Application**: Core STAC API server
- **STACServer Class**: Business logic and data access
- **Pydantic Models**: Request/response validation
- **Redis Cache**: Distributed caching layer
- **Nginx**: Reverse proxy and load balancer

### **Data Flow**
1. **Request** → Nginx (rate limiting, SSL termination)
2. **Nginx** → FastAPI (load balancing)
3. **FastAPI** → STACServer (business logic)
4. **STACServer** → Cache/S3 (data retrieval)
5. **Response** ← Validated JSON (STAC compliant)

### **Caching Strategy**
- **L1 Cache**: In-memory Python dictionaries
- **L2 Cache**: Redis for distributed caching
- **L3 Cache**: S3 with CloudFront (optional)

## 🧪 Testing

### **Run Test Suite**
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest test_stac_api.py -v

# Run specific test categories
pytest test_stac_api.py::TestSTACAPI -v
pytest test_stac_api.py::TestPerformance -v
```

### **Test Categories**
- **API Endpoints**: Test all STAC API endpoints
- **STAC Compliance**: Validate STAC specification compliance
- **Performance**: Response time and concurrency tests
- **Geological Extensions**: Test custom geological endpoints

### **Load Testing**
```bash
# Install locust
pip install locust

# Run load tests
locust -f load_test.py --host=http://localhost:8000
```

## 📈 Performance

### **Benchmarks**
- **Search Response**: < 200ms for 10 items
- **Collection Listing**: < 100ms
- **Concurrent Requests**: 100+ req/sec
- **Memory Usage**: < 512MB base + cache

### **Optimization Features**
- **Async Operations**: Non-blocking I/O throughout
- **Connection Pooling**: Efficient database connections
- **Response Caching**: Redis-based caching
- **Spatial Indexing**: Fast bounding box queries

## 🔐 Security

### **Authentication**
- API key authentication (optional)
- JWT token support (configurable)
- Rate limiting per IP/user

### **CORS Configuration**
```python
# Configured for frontend integration
allow_origins=["https://geovision.ai", "https://app.geovision.ai"]
allow_methods=["GET", "POST", "OPTIONS"]
allow_headers=["Content-Type", "Authorization"]
```

### **Rate Limiting**
- **General API**: 10 requests/second
- **Search Endpoints**: 5 requests/second
- **Burst Allowance**: 20 requests

## 🚀 Deployment

### **Development**
```bash
# Local development with hot reload
uvicorn stac_server:app --reload

# Docker development environment
docker-compose up -d
```

### **Staging**
```bash
# Deploy to staging environment
ENVIRONMENT=staging ./deploy_stac_api.sh
```

### **Production**
```bash
# Deploy to production with scaling
./deploy_stac_api.sh production

# Manual scaling
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale stac-api=3
```

### **Kubernetes (Optional)**
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stac-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stac-api
  template:
    metadata:
      labels:
        app: stac-api
    spec:
      containers:
      - name: stac-api
        image: geovision/stac-api:latest
        ports:
        - containerPort: 8000
        env:
        - name: STAC_API_BASE_URL
          value: "https://stac.geovision.ai"
```

## 📊 Monitoring

### **Health Checks**
- **Application**: `/health` endpoint
- **Dependencies**: Redis, S3 connectivity
- **Performance**: Response time monitoring

### **Metrics**
- **Request Rate**: Requests per second
- **Response Time**: P50, P95, P99 percentiles
- **Error Rate**: 4xx/5xx response rates
- **Cache Hit Rate**: Redis cache effectiveness

### **Logging**
```python
# Structured logging with correlation IDs
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "message": "Search request processed",
  "request_id": "req_123456",
  "user_id": "user_789",
  "response_time_ms": 150,
  "items_returned": 10
}
```

## 🔧 Troubleshooting

### **Common Issues**

**Service Won't Start**
```bash
# Check logs
docker-compose logs stac-api

# Check health
curl http://localhost:8000/health
```

**Slow Search Responses**
```bash
# Check Redis connection
redis-cli ping

# Monitor cache hit rates
redis-cli info stats
```

**S3 Access Issues**
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://geovision-ai-miner-data/
```

### **Performance Tuning**
- **Increase Redis memory**: `maxmemory 2gb`
- **Tune connection pools**: Adjust database connections
- **Enable compression**: Gzip responses for large payloads
- **CDN Integration**: CloudFront for static assets

## 📚 References

- **STAC Specification**: https://stacspec.org/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **PySTAC Library**: https://pystac.readthedocs.io/
- **Docker Best Practices**: https://docs.docker.com/develop/dev-best-practices/

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/new-endpoint`
3. **Add tests**: Ensure new features have test coverage
4. **Run test suite**: `pytest test_stac_api.py -v`
5. **Submit pull request**: Include description and test results

The FastAPI STAC server provides a robust, scalable foundation for serving geological data catalogs with full STAC compliance and geological-specific extensions.

**🌍 Ready to serve geological data at scale! ⛏️✨**