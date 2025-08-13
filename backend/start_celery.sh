#!/bin/bash

# GeoVision AI Miner - Celery Worker Startup Script
# Starts Celery workers for background task processing

set -e

echo "🌍 GeoVision AI Miner - Starting Celery Workers"
echo "=============================================="

# Check if Redis is available
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start Redis first:"
    echo "   docker run -d -p 6379:6379 redis:7-alpine"
    echo "   or"
    echo "   redis-server"
    exit 1
fi

echo "✅ Redis is running"

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Default configuration
WORKER_CONCURRENCY=${CELERY_WORKER_CONCURRENCY:-4}
LOG_LEVEL=${CELERY_LOG_LEVEL:-info}
QUEUES=${CELERY_QUEUES:-"default,features,ai,qa,lims,audit"}

echo "📋 Celery Configuration:"
echo "  Concurrency: $WORKER_CONCURRENCY"
echo "  Log Level: $LOG_LEVEL"
echo "  Queues: $QUEUES"
echo ""

# Start Celery worker
echo "🚀 Starting Celery worker..."
exec celery -A app.core.celery_app worker \
    --loglevel=$LOG_LEVEL \
    --concurrency=$WORKER_CONCURRENCY \
    --queues=$QUEUES \
    --hostname=geovision-worker@%h \
    --time-limit=1800 \
    --soft-time-limit=1500 \
    --max-tasks-per-child=1000 \
    --prefetch-multiplier=1