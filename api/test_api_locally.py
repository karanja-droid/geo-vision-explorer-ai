#!/usr/bin/env python3
"""
Quick test script for the STAC API
Run this to test the API locally before deployment
"""

import requests
import json
import sys
from datetime import datetime

def test_endpoint(url, description):
    """Test an API endpoint and print results"""
    print(f"\n🔍 Testing: {description}")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success - Response type: {data.get('type', 'unknown')}")
            
            # Print some key info based on endpoint
            if 'collections' in data:
                print(f"   Collections found: {len(data['collections'])}")
            elif 'features' in data:
                print(f"   Features found: {len(data['features'])}")
            elif data.get('type') == 'Catalog':
                print(f"   Catalog ID: {data.get('id')}")
                print(f"   Links: {len(data.get('links', []))}")
            
            return True
        else:
            print(f"❌ Failed - {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def main():
    """Run API tests"""
    base_url = "http://localhost:8000"
    
    print("🌍 GeoVision AI Miner - STAC API Test Suite")
    print("=" * 50)
    
    # Test endpoints
    tests = [
        (f"{base_url}/health", "Health Check"),
        (f"{base_url}/", "Root Catalog"),
        (f"{base_url}/collections", "Collections List"),
        (f"{base_url}/collections/spectral-landsat8-zmb", "Specific Collection"),
        (f"{base_url}/search?limit=5", "Search (GET)"),
        (f"{base_url}/search?bbox=20,-30,35,-15&limit=3", "Search with BBox"),
        (f"{base_url}/geological/minerals/copper?limit=2", "Geological - Copper Search"),
        (f"{base_url}/geological/data-types/spectral?limit=2", "Geological - Spectral Data"),
    ]
    
    passed = 0
    total = len(tests)
    
    for url, description in tests:
        if test_endpoint(url, description):
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the API implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())