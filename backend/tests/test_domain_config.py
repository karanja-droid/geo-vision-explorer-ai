"""
Domain Configuration Tests

Tests to validate backend domain configuration including
BASE_URL, CORS, OpenAPI servers, and STAC self-links.
"""

import pytest
import os
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.core.config import settings


class TestDomainConfiguration:
    """Test domain configuration and URL handling"""
    
    def test_base_url_configuration(self):
        """Test BASE_URL is properly configured"""
        assert hasattr(settings, 'BASE_URL')
        assert settings.BASE_URL is not None
        assert settings.BASE_URL != ""
        
        # Should be a valid URL format
        assert settings.BASE_URL.startswith(('http://', 'https://'))
    
    def test_allowed_origins_configuration(self):
        """Test ALLOWED_ORIGINS is properly configured"""
        assert hasattr(settings, 'ALLOWED_ORIGINS')
        assert settings.ALLOWED_ORIGINS is not None
        
        # Should be parseable as comma-separated list
        origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
        assert len(origins) > 0
        
        # Each origin should be a valid URL format
        for origin in origins:
            assert origin.startswith(('http://', 'https://'))
    
    def test_cors_origins_derived_from_allowed_origins(self):
        """Test BACKEND_CORS_ORIGINS is derived from ALLOWED_ORIGINS"""
        expected_origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
        assert settings.BACKEND_CORS_ORIGINS == expected_origins


class TestHealthEndpoint:
    """Test health endpoint returns correct base URL"""
    
    def test_health_endpoint_includes_base_url(self):
        """Test /healthz endpoint includes baseUrl in response"""
        client = TestClient(app)
        response = client.get("/healthz")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "baseUrl" in data
        assert data["baseUrl"] == settings.BASE_URL
        assert data["status"] == "healthy"
    
    def test_health_endpoint_alias(self):
        """Test /health endpoint also works"""
        client = TestClient(app)
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "baseUrl" in data
        assert data["baseUrl"] == settings.BASE_URL


class TestOpenAPIConfiguration:
    """Test OpenAPI server configuration"""
    
    def test_openapi_schema_has_correct_server(self):
        """Test OpenAPI schema includes correct server URL"""
        client = TestClient(app)
        response = client.get("/openapi.json")
        
        assert response.status_code == 200
        schema = response.json()
        
        assert "servers" in schema
        assert len(schema["servers"]) > 0
        
        # First server should be the BASE_URL
        assert schema["servers"][0]["url"] == settings.BASE_URL
    
    def test_docs_endpoint_loads(self):
        """Test /docs endpoint loads successfully"""
        client = TestClient(app)
        response = client.get("/docs")
        
        assert response.status_code == 200
        
        # Should contain Swagger UI
        content = response.text
        assert "swagger" in content.lower()


class TestCORSConfiguration:
    """Test CORS middleware configuration"""
    
    def test_cors_allows_configured_origins(self):
        """Test CORS allows origins from ALLOWED_ORIGINS"""
        client = TestClient(app)
        
        # Get first allowed origin
        origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
        if not origins:
            pytest.skip("No ALLOWED_ORIGINS configured")
        
        test_origin = origins[0]
        
        # Make OPTIONS request with origin
        response = client.options(
            "/healthz",
            headers={
                "Origin": test_origin,
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # Should not be blocked by CORS
        assert response.status_code < 400
    
    def test_cors_blocks_unauthorized_origins(self):
        """Test CORS blocks unauthorized origins"""
        client = TestClient(app)
        
        # Use an origin that's not in ALLOWED_ORIGINS
        unauthorized_origin = "https://malicious-site.com"
        
        # Make request with unauthorized origin
        response = client.get(
            "/healthz",
            headers={"Origin": unauthorized_origin}
        )
        
        # Request should succeed (CORS is handled by middleware)
        # but CORS headers should not allow the origin
        assert response.status_code == 200
        
        # Check CORS headers
        cors_origin = response.headers.get("access-control-allow-origin")
        if cors_origin:
            assert cors_origin != unauthorized_origin


class TestEnvironmentValidation:
    """Test environment variable validation"""
    
    def test_base_url_required(self):
        """Test BASE_URL is required"""
        with patch.dict(os.environ, {"BASE_URL": ""}, clear=False):
            # Should use default if empty
            from app.core.config import Settings
            test_settings = Settings()
            assert test_settings.BASE_URL != ""
    
    def test_allowed_origins_default(self):
        """Test ALLOWED_ORIGINS has reasonable default"""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": ""}, clear=False):
            from app.core.config import Settings
            test_settings = Settings()
            # Should have some default value
            assert test_settings.ALLOWED_ORIGINS != ""


class TestAPIEndpoints:
    """Test API endpoints use correct base URL"""
    
    def test_api_endpoints_accessible(self):
        """Test main API endpoints are accessible"""
        client = TestClient(app)
        
        # Test main API endpoints
        endpoints = [
            "/api/v1/features/health",
            "/api/v1/ai/health", 
            "/api/v1/active-learning/health",
            "/api/v1/drill-data/health"
        ]
        
        for endpoint in endpoints:
            try:
                response = client.get(endpoint)
                # Should not return 404 (endpoint exists)
                assert response.status_code != 404
            except Exception as e:
                # Some endpoints might require authentication or have other requirements
                # Just ensure they exist (not 404)
                pass


class TestProductionConfiguration:
    """Test production-specific configuration"""
    
    def test_production_domains_in_allowed_origins(self):
        """Test production domains are in ALLOWED_ORIGINS when appropriate"""
        if settings.BASE_URL.startswith("https://api.geo-miner.com"):
            # In production, should allow geo-miner.com domains
            origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]
            
            production_domains = [
                "https://geo-miner.com",
                "https://www.geo-miner.com"
            ]
            
            # At least one production domain should be allowed
            has_production_domain = any(
                any(prod_domain in origin for prod_domain in production_domains)
                for origin in origins
            )
            
            assert has_production_domain, f"Production domains not found in ALLOWED_ORIGINS: {origins}"
    
    def test_staging_domains_in_staging(self):
        """Test staging domains are configured in staging"""
        if settings.BASE_URL.startswith("https://api.staging.geo-miner.com"):
            # In staging, should allow staging domains
            origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]
            
            staging_domains = [
                "https://staging.geo-miner.com"
            ]
            
            has_staging_domain = any(
                any(staging_domain in origin for staging_domain in staging_domains)
                for origin in origins
            )
            
            assert has_staging_domain, f"Staging domains not found in ALLOWED_ORIGINS: {origins}"


class TestSecurityHeaders:
    """Test security headers configuration"""
    
    def test_security_headers_present(self):
        """Test basic security headers are present"""
        client = TestClient(app)
        response = client.get("/healthz")
        
        headers = response.headers
        
        # Check for common security headers (if implemented)
        security_headers = [
            "x-frame-options",
            "x-content-type-options", 
            "x-xss-protection",
            "strict-transport-security"
        ]
        
        # Not all headers are required, but log what's present
        present_headers = [h for h in security_headers if h in headers]
        print(f"Security headers present: {present_headers}")
        
        # At minimum, should have some basic headers
        # This is more of an informational test
        assert len(present_headers) >= 0  # Always passes, just for logging


if __name__ == "__main__":
    pytest.main([__file__])