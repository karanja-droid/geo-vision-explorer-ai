#!/bin/bash

# GeoVision AI Miner - Development Server Startup Script
# Quick way to start the STAC API for local development

set -e

echo "🌍 GeoVision AI Miner - Starting Development Server"
echo "=================================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "stac_server.py" ]; then
    echo "❌ stac_server.py not found. Make sure you're in the api directory."
    exit 1
fi

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Set environment variables for development
export STAC_CATALOG_ROOT="./stac_catalogs"
export GEOVISION_S3_BUCKET="s3://geovision-ai-miner-data"
export STAC_API_BASE_URL="http://localhost:8000"
export ENVIRONMENT="development"

echo "🚀 Starting FastAPI server..."
echo "   API URL: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   Health Check: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
python3 -m uvicorn stac_server:app --reload --host 0.0.0.0 --port 8000