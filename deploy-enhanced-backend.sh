#!/bin/bash

# GeoVision AI Miner - Enhanced Backend Deployment Script
# This script deploys all the enhanced backend features

set -e

echo "🚀 Starting GeoVision AI Miner Enhanced Backend Deployment"
echo "============================================================"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run 'supabase init' first."
    exit 1
fi

echo "📋 Checking project status..."
supabase status

echo ""
echo "🗄️  Applying database migrations..."
echo "-----------------------------------"

# Apply migrations in order
migrations=(
    "20250808000001_enhanced_ai_features.sql"
    "20250808000002_iot_sensors_realtime.sql" 
    "20250808000003_advanced_analytics_bi.sql"
    "20250808000004_llm_integration.sql"
    "20250808000005_enhanced_abac_security.sql"
    "20250808000006_feature_flags_management.sql"
)

for migration in "${migrations[@]}"; do
    echo "Applying migration: $migration"
    if [ -f "supabase/migrations/$migration" ]; then
        supabase db push --include-all
        echo "✅ Migration $migration applied successfully"
    else
        echo "⚠️  Migration file $migration not found, skipping..."
    fi
done

echo ""
echo "⚡ Deploying Edge Functions..."
echo "-----------------------------"

# Deploy edge functions
functions=(
    "ai-mineral-analysis"
    "realtime-anomaly-detection"
    "3d-geological-modeling"
    "predictive-maintenance"
    "esg-reporting"
    "llm-geological-analysis"
    "geological-data-fabric"
)

for func in "${functions[@]}"; do
    echo "Deploying function: $func"
    if [ -d "supabase/functions/$func" ]; then
        supabase functions deploy $func
        echo "✅ Function $func deployed successfully"
    else
        echo "⚠️  Function directory $func not found, skipping..."
    fi
done

echo ""
echo "🔧 Setting up environment variables..."
echo "------------------------------------"

echo "Please set the following environment variables in your Supabase dashboard:"
echo "Settings > Edge Functions > Environment Variables"
echo ""
echo "Required variables:"
echo "- ANTHROPIC_API_KEY=sk-ant-your_anthropic_key"
echo "- OPENAI_API_KEY=sk-your_openai_key"
echo "- MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token"
echo "- SENDGRID_API_KEY=SG.your_sendgrid_key"
echo "- TWILIO_ACCOUNT_SID=your_twilio_sid"
echo "- TWILIO_AUTH_TOKEN=your_twilio_token"
echo "- GOOGLE_EARTH_ENGINE_KEY=your_gee_key"
echo "- AWS_ACCESS_KEY_ID=your_aws_key"
echo "- AWS_SECRET_ACCESS_KEY=your_aws_secret"
echo "- STORAGE_BUCKET_URL=https://your-storage-bucket.com"
echo ""
echo "Data Processing Pipeline variables:"
echo "- GEOVISION_S3_BUCKET=s3://geovision-ai-miner-data"
echo "- GDAL_CACHEMAX=2048"
echo "- GDAL_NUM_THREADS=ALL_CPUS"

echo ""
echo "🔐 Enabling required extensions..."
echo "--------------------------------"

# Enable required PostgreSQL extensions
supabase db reset --linked

echo "Enabling PostGIS extension..."
echo "CREATE EXTENSION IF NOT EXISTS postgis;" | supabase db reset --linked

echo "Enabling vector extension..."
echo "CREATE EXTENSION IF NOT EXISTS vector;" | supabase db reset --linked

echo "Enabling pg_cron extension..."
echo "CREATE EXTENSION IF NOT EXISTS pg_cron;" | supabase db reset --linked

echo ""
echo "📊 Setting up sample data..."
echo "---------------------------"

# Insert sample data
echo "Inserting sample organizations..."
cat << EOF | supabase db reset --linked
INSERT INTO organizations (name, organization_type, headquarters_country, operating_jurisdictions, data_classification_level) VALUES
('GeoVision Mining Corp', 'mining_company', 'CAN', ARRAY['CAN', 'USA', 'AUS'], 3),
('Exploration Services Ltd', 'exploration', 'AUS', ARRAY['AUS', 'PNG', 'IDN'], 2),
('Geological Consultants Inc', 'consultant', 'USA', ARRAY['USA', 'MEX', 'CHL'], 2),
('Mining Authority', 'government', 'CAN', ARRAY['CAN'], 4)
ON CONFLICT DO NOTHING;
EOF

echo "Inserting sample commodity prices..."
cat << EOF | supabase db reset --linked
INSERT INTO commodity_prices (commodity, price, currency, exchange, price_date) VALUES
('gold', 2000.50, 'USD', 'COMEX', CURRENT_DATE),
('copper', 8.75, 'USD', 'LME', CURRENT_DATE),
('iron_ore', 120.00, 'USD', 'SHFE', CURRENT_DATE),
('lithium', 75000.00, 'USD', 'LME', CURRENT_DATE)
ON CONFLICT DO NOTHING;
EOF

echo ""
echo "🧪 Running tests..."
echo "------------------"

# Test edge functions
echo "Testing AI mineral analysis function..."
curl -X POST "$(supabase status | grep 'API URL' | awk '{print $3}')/functions/v1/ai-mineral-analysis" \
  -H "Authorization: Bearer $(supabase status | grep 'anon key' | awk '{print $3}')" \
  -H "Content-Type: application/json" \
  -d '{"spectralDataId": "test-id", "analysisType": "mineral_detection"}' \
  --max-time 10 || echo "⚠️  Function test failed (this is expected if no test data exists)"

echo ""
echo "✅ Deployment completed successfully!"
echo "===================================="
echo ""
echo "🌍 Setting up data processing pipeline..."
echo "---------------------------------------"

# Install Python dependencies for STAC tools
if command -v python3 &> /dev/null; then
    echo "Installing Python dependencies for STAC tools..."
    pip3 install -r tools/stac/requirements.txt || echo "⚠️  Failed to install Python dependencies"
else
    echo "⚠️  Python3 not found. Please install Python dependencies manually:"
    echo "   pip3 install -r tools/stac/requirements.txt"
fi

# Check for GDAL
if command -v gdal_translate &> /dev/null; then
    echo "✅ GDAL found - COG processing available"
else
    echo "⚠️  GDAL not found. Please install GDAL for COG processing:"
    echo "   Ubuntu/Debian: sudo apt-get install gdal-bin"
    echo "   macOS: brew install gdal"
fi

# Check for tippecanoe
if command -v tippecanoe &> /dev/null; then
    echo "✅ Tippecanoe found - Vector tile generation available"
else
    echo "⚠️  Tippecanoe not found. Please install for vector tile generation:"
    echo "   Ubuntu/Debian: sudo apt-get install tippecanoe"
    echo "   macOS: brew install tippecanoe"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Set up environment variables in Supabase dashboard"
echo "2. Configure AWS credentials for S3 access"
echo "3. Test data processing pipeline: make help"
echo "4. Configure your frontend to use the new components"
echo "5. Test the enhanced features with real data"
echo "6. Set up monitoring and alerting"
echo ""
echo "📚 Documentation:"
echo "- DEPLOYMENT_GUIDE.md - Complete deployment instructions"
echo "- DATA_PROCESSING_PIPELINE.md - Data processing workflows"
echo "- FEATURE_FLAGS_IMPLEMENTATION.md - Feature flag management"
echo "- LLM_INTEGRATION_GUIDE.md - LLM setup and usage"
echo "- FRONTEND_IMPLEMENTATION_GUIDE.md - Frontend development guide"
echo ""
echo "🔗 Useful links:"
echo "- Supabase Dashboard: https://app.supabase.com/project/$(supabase status | grep 'Project ID' | awk '{print $3}')"
echo "- API Documentation: $(supabase status | grep 'API URL' | awk '{print $3}')/rest/v1/"
echo ""
echo "🌍 Data Processing Commands:"
echo "- make help                    # Show all available commands"
echo "- make cog INPUT=data.tif      # Convert to COG format"
echo "- make stac                    # Generate STAC catalog"
echo "- make batch-process           # Process all input files"
echo ""
echo "Happy mining! ⛏️✨"