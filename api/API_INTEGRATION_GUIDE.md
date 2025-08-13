# 🌍 GeoVision AI Miner - API Integration Guide

Complete guide for integrating with the STAC API server for geological data access.

## 🚀 Quick Start

### Local Development
```bash
# Navigate to API directory
cd geo-vision-explorer-ai/api/

# Start development server
./start_dev_server.sh

# Test the API
python3 test_api_locally.py
```

### Docker Development
```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f stac-api

# Stop services
docker-compose down
```

## 📋 API Endpoints Overview

### Core STAC Endpoints

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/` | GET | Root catalog | `GET /` |
| `/collections` | GET | List collections | `GET /collections` |
| `/collections/{id}` | GET | Get collection | `GET /collections/spectral-landsat8-zmb` |
| `/collections/{id}/items` | GET | Collection items | `GET /collections/spectral-landsat8-zmb/items` |
| `/collections/{id}/items/{item_id}` | GET | Specific item | `GET /collections/spectral-landsat8-zmb/items/LC08_L1TP_174065_20240315` |
| `/search` | GET/POST | Search items | `GET /search?limit=10` |

### Geological Extensions

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/geological/minerals/{mineral}` | GET | Search by mineral | `GET /geological/minerals/copper` |
| `/geological/data-types/{type}` | GET | Search by data type | `GET /geological/data-types/spectral` |

### Utility Endpoints

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/health` | GET | Health check | `GET /health` |

## 🔍 Search Examples

### Basic Search
```bash
# Get 10 items
curl "http://localhost:8000/search?limit=10"

# Search with bounding box (Southern Africa)
curl "http://localhost:8000/search?bbox=16,-35,35,-15&limit=5"

# Search specific collections
curl "http://localhost:8000/search?collections=spectral-landsat8-zmb,hyperspectral-aviris-bwa&limit=5"
```

### Advanced Search (POST)
```bash
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "bbox": [20, -30, 35, -15],
    "datetime": "2024-01-01/2024-12-31",
    "collections": ["spectral-landsat8-zmb"],
    "query": {
      "geological:confidence": {"gte": 0.8},
      "geological:target_mineral": "copper"
    },
    "limit": 10
  }'
```

### Geological Searches
```bash
# Find copper deposits
curl "http://localhost:8000/geological/minerals/copper?limit=5"

# Find hyperspectral data
curl "http://localhost:8000/geological/data-types/hyperspectral?limit=5"

# Find high-confidence data
curl -X POST "http://localhost:8000/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "geological:confidence": {"gte": 0.9}
    },
    "limit": 10
  }'
```

## 🐍 Python Client Examples

### Basic Usage
```python
import requests
import json

# Base URL
base_url = "http://localhost:8000"

# Get root catalog
response = requests.get(f"{base_url}/")
catalog = response.json()
print(f"Catalog: {catalog['title']}")

# List collections
response = requests.get(f"{base_url}/collections")
collections = response.json()
print(f"Found {len(collections['collections'])} collections")

# Search for items
response = requests.get(f"{base_url}/search?limit=5")
results = response.json()
print(f"Found {len(results['features'])} items")
```

### Advanced Search
```python
import requests

def search_geological_data(mineral, confidence_threshold=0.8, limit=10):
    """Search for geological data by mineral with confidence threshold"""
    
    search_params = {
        "query": {
            "geological:target_mineral": mineral,
            "geological:confidence": {"gte": confidence_threshold}
        },
        "limit": limit
    }
    
    response = requests.post(
        "http://localhost:8000/search",
        json=search_params
    )
    
    if response.status_code == 200:
        results = response.json()
        return results['features']
    else:
        raise Exception(f"Search failed: {response.text}")

# Find high-confidence copper data
copper_data = search_geological_data("copper", confidence_threshold=0.85)
print(f"Found {len(copper_data)} high-confidence copper datasets")
```

### Working with STAC Items
```python
import requests
from datetime import datetime

def analyze_stac_item(item):
    """Extract key information from a STAC item"""
    
    properties = item['properties']
    
    info = {
        'id': item['id'],
        'collection': item.get('collection'),
        'datetime': properties.get('datetime'),
        'bbox': item['bbox'],
        'data_type': properties.get('geological:data_type'),
        'target_mineral': properties.get('geological:target_mineral'),
        'confidence': properties.get('geological:confidence'),
        'assets': list(item['assets'].keys())
    }
    
    return info

# Get search results
response = requests.get("http://localhost:8000/search?limit=3")
results = response.json()

# Analyze each item
for item in results['features']:
    info = analyze_stac_item(item)
    print(f"Item: {info['id']}")
    print(f"  Type: {info['data_type']}")
    print(f"  Mineral: {info['target_mineral']}")
    print(f"  Confidence: {info['confidence']}")
    print(f"  Assets: {', '.join(info['assets'])}")
    print()
```

## 🌐 JavaScript/Frontend Integration

### Fetch API
```javascript
// Basic search
async function searchGeologicalData(params = {}) {
    const url = new URL('http://localhost:8000/search');
    
    // Add query parameters
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.features;
    } catch (error) {
        console.error('Search failed:', error);
        throw error;
    }
}

// Usage
searchGeologicalData({ limit: 10, bbox: '20,-30,35,-15' })
    .then(items => {
        console.log(`Found ${items.length} items`);
        items.forEach(item => {
            console.log(`- ${item.id}: ${item.properties['geological:target_mineral']}`);
        });
    });
```

### Advanced POST Search
```javascript
async function advancedSearch(searchParams) {
    try {
        const response = await fetch('http://localhost:8000/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchParams)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Advanced search failed:', error);
        throw error;
    }
}

// Search for high-confidence copper data
const searchParams = {
    query: {
        'geological:target_mineral': 'copper',
        'geological:confidence': { gte: 0.8 }
    },
    bbox: [25, -18, 34, -8], // Zambia copper belt
    limit: 20
};

advancedSearch(searchParams)
    .then(results => {
        console.log(`Found ${results.features.length} copper datasets`);
        // Process results...
    });
```

## 🗺️ Leaflet Map Integration

```javascript
// Initialize map
const map = L.map('map').setView([-25, 25], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Function to add STAC items to map
async function addSTACItemsToMap(searchParams) {
    try {
        const response = await fetch('http://localhost:8000/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchParams)
        });
        
        const data = await response.json();
        
        data.features.forEach(item => {
            const bounds = [
                [item.bbox[1], item.bbox[0]], // SW
                [item.bbox[3], item.bbox[2]]  // NE
            ];
            
            const rectangle = L.rectangle(bounds, {
                color: getColorByMineral(item.properties['geological:target_mineral']),
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.3
            });
            
            rectangle.bindPopup(`
                <b>${item.id}</b><br>
                Type: ${item.properties['geological:data_type']}<br>
                Mineral: ${item.properties['geological:target_mineral']}<br>
                Confidence: ${item.properties['geological:confidence']}
            `);
            
            rectangle.addTo(map);
        });
        
    } catch (error) {
        console.error('Failed to load STAC items:', error);
    }
}

function getColorByMineral(mineral) {
    const colors = {
        'copper': '#b87333',
        'gold': '#ffd700',
        'diamond': '#b9f2ff',
        'platinum': '#e5e4e2'
    };
    return colors[mineral] || '#666666';
}

// Load copper data on map
addSTACItemsToMap({
    query: { 'geological:target_mineral': 'copper' },
    limit: 50
});
```

## 🔧 Configuration

### Environment Variables
```bash
# Required
export STAC_CATALOG_ROOT="./stac_catalogs"
export GEOVISION_S3_BUCKET="s3://geovision-ai-miner-data"
export STAC_API_BASE_URL="http://localhost:8000"

# Optional
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
export AWS_DEFAULT_REGION="us-west-2"
export REDIS_URL="redis://localhost:6379"
```

### Docker Environment
```yaml
# docker-compose.yml
services:
  stac-api:
    environment:
      - STAC_CATALOG_ROOT=/app/stac_catalogs
      - GEOVISION_S3_BUCKET=s3://geovision-ai-miner-data
      - STAC_API_BASE_URL=http://localhost:8000
```

## 📊 Response Formats

### STAC Catalog Response
```json
{
  "type": "Catalog",
  "stac_version": "1.0.0",
  "id": "geovision-root",
  "title": "GeoVision AI Miner Root Catalog",
  "description": "Root catalog for geological datasets",
  "links": [
    {
      "rel": "self",
      "href": "http://localhost:8000/",
      "type": "application/json"
    }
  ]
}
```

### Search Results Response
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "stac_version": "1.0.0",
      "id": "LC08_L1TP_174065_20240315",
      "collection": "spectral-landsat8-zmb",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "bbox": [27.5, -13.5, 29.0, -12.0],
      "properties": {
        "datetime": "2024-03-15T10:30:00Z",
        "geological:data_type": "spectral",
        "geological:target_mineral": "copper",
        "geological:confidence": 0.87
      },
      "assets": {
        "thumbnail": { "href": "...", "type": "image/jpeg" },
        "B1": { "href": "...", "type": "image/tiff" }
      }
    }
  ],
  "links": [...],
  "context": {
    "returned": 1,
    "matched": 1
  }
}
```

## 🚨 Error Handling

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (collection/item doesn't exist)
- `422` - Validation Error (invalid request body)
- `500` - Internal Server Error

### Error Response Format
```json
{
  "detail": "Collection spectral-landsat8-invalid not found"
}
```

### Python Error Handling
```python
import requests

try:
    response = requests.get("http://localhost:8000/collections/invalid-collection")
    response.raise_for_status()  # Raises exception for 4xx/5xx status codes
    data = response.json()
except requests.exceptions.HTTPError as e:
    print(f"HTTP Error: {e}")
    print(f"Response: {e.response.text}")
except requests.exceptions.RequestException as e:
    print(f"Request Error: {e}")
```

## 🔍 Testing & Debugging

### Health Check
```bash
curl http://localhost:8000/health
```

### API Documentation
- Interactive docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Logging
```bash
# Docker logs
docker-compose logs -f stac-api

# Local development
# Logs appear in terminal where server is running
```

## 🚀 Production Deployment

### Using Docker
```bash
# Build and deploy
./deploy_stac_api.sh production

# Or deploy to staging
ENVIRONMENT=staging ./deploy_stac_api.sh staging
```

### Environment-Specific URLs
- **Development**: `http://localhost:8000`
- **Staging**: `https://stac-staging.geovision.ai`
- **Production**: `https://stac.geovision.ai`

## 📚 Additional Resources

- **STAC Specification**: https://stacspec.org/
- **PySTAC Documentation**: https://pystac.readthedocs.io/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **STAC Browser**: https://radiantearth.github.io/stac-browser/

## 🤝 Support

For API support and questions:
1. Check the health endpoint: `/health`
2. Review API documentation: `/docs`
3. Check server logs for errors
4. Validate request format against examples above

The STAC API provides a standardized way to discover and access geological datasets with rich metadata and spatial/temporal search capabilities.

**🌍 Ready to explore geological data! ⛏️✨**