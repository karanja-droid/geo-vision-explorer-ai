# GeoVision AI Miner - Enhanced Backend Deployment Guide

## 🚀 Overview

This guide covers the deployment of the enhanced GeoVision AI Miner backend with advanced AI capabilities, IoT integration, 3D geological modeling, and comprehensive business intelligence features.

## 📋 Prerequisites

### Required Services
- **Supabase Project** - PostgreSQL database with PostGIS extension
- **Mapbox Account** - For 3D mapping and visualization
- **Cloud Storage** - For 3D models, spectral data, and reports
- **Email Service** - For notifications (SendGrid, AWS SES, etc.)
- **SMS Service** - For critical alerts (Twilio, etc.)

### Required Extensions
```sql
-- Enable in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
```

## 🗄️ Database Migration Deployment

### 1. Deploy New Migrations
```bash
# Apply migrations in order
supabase db push

# Or apply individually
supabase migration up --file 20250808000001_enhanced_ai_features.sql
supabase migration up --file 20250808000002_iot_sensors_realtime.sql
supabase migration up --file 20250808000003_advanced_analytics_bi.sql
```

### 2. Verify Migration Success
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'spectral_data', 'cv_analysis_results', 'core_samples',
  'iot_devices', 'sensor_readings', 'drone_missions',
  'economic_models', 'risk_assessments', 'esg_metrics'
);

-- Verify RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('spectral_data', 'iot_devices', 'economic_models');
```

## ⚡ Edge Functions Deployment

### 1. Deploy AI Analysis Function
```bash
supabase functions deploy ai-mineral-analysis --project-ref YOUR_PROJECT_REF
```

### 2. Deploy Anomaly Detection Function
```bash
supabase functions deploy realtime-anomaly-detection --project-ref YOUR_PROJECT_REF
```

### 3. Deploy 3D Modeling Function
```bash
supabase functions deploy 3d-geological-modeling --project-ref YOUR_PROJECT_REF
```

### 4. Deploy Predictive Maintenance Function
```bash
supabase functions deploy predictive-maintenance --project-ref YOUR_PROJECT_REF
```

### 5. Deploy ESG Reporting Function
```bash
supabase functions deploy esg-reporting --project-ref YOUR_PROJECT_REF
```

### 6. Deploy LLM Geological Analysis Function
```bash
supabase functions deploy llm-geological-analysis --project-ref YOUR_PROJECT_REF
```

### 7. Verify Function Deployment
```bash
supabase functions list --project-ref YOUR_PROJECT_REF
```

## 🔧 Environment Configuration

### Supabase Environment Variables
```bash
# Set in Supabase Dashboard > Settings > Edge Functions
MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
SENDGRID_API_KEY=SG.your_sendgrid_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token

# LLM Integration (Primary: Claude for geological analysis)
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key  # Primary LLM for geological analysis
OPENAI_API_KEY=sk-your_openai_key  # Secondary LLM for reports and communication

GOOGLE_EARTH_ENGINE_KEY=your_gee_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
STORAGE_BUCKET_URL=https://your-storage-bucket.com
```

### Database Configuration
```sql
-- Set up cron jobs for automated tasks
SELECT cron.schedule(
  'daily-anomaly-check',
  '0 */6 * * *', -- Every 6 hours
  'SELECT net.http_post(url:=''https://your-project.supabase.co/functions/v1/realtime-anomaly-detection'', headers:=''{"Authorization": "Bearer YOUR_SERVICE_KEY"}''::jsonb);'
);

-- Set up automated ESG reporting
SELECT cron.schedule(
  'monthly-esg-report',
  '0 9 1 * *', -- 9 AM on 1st of each month
  'SELECT net.http_post(url:=''https://your-project.supabase.co/functions/v1/esg-reporting'', headers:=''{"Authorization": "Bearer YOUR_SERVICE_KEY"}''::jsonb);'
);
```

## 📊 Data Seeding

### 1. Seed Sample Data
```sql
-- Insert sample commodity prices
INSERT INTO commodity_prices (commodity, price, currency, exchange, price_date) VALUES
('gold', 2000.50, 'USD', 'COMEX', CURRENT_DATE),
('copper', 8.75, 'USD', 'LME', CURRENT_DATE),
('iron_ore', 120.00, 'USD', 'SHFE', CURRENT_DATE),
('lithium', 75000.00, 'USD', 'LME', CURRENT_DATE);

-- Insert KPI definitions
INSERT INTO kpi_definitions (kpi_name, kpi_category, description, unit, frequency) VALUES
('Safety Incident Rate', 'safety', 'Number of safety incidents per million hours worked', 'incidents/million hours', 'monthly'),
('Water Usage Efficiency', 'environmental', 'Water consumption per tonne of ore processed', 'm³/tonne', 'daily'),
('Community Satisfaction', 'social', 'Average satisfaction rating from community surveys', 'score (1-5)', 'quarterly'),
('Production Cost', 'operational', 'Cost per tonne of ore processed', 'USD/tonne', 'daily');

-- Insert regulatory requirements (example for mining jurisdictions)
INSERT INTO regulatory_requirements (jurisdiction, requirement_type, requirement_name, description, regulatory_body) VALUES
('Australia', 'environmental_assessment', 'Environmental Impact Statement', 'Comprehensive environmental impact assessment required for major mining projects', 'Department of Environment'),
('Canada', 'permit', 'Mining Lease', 'Legal right to extract minerals from specified area', 'Provincial Mining Department'),
('USA', 'safety_standard', 'MSHA Compliance', 'Mine Safety and Health Administration safety standards', 'MSHA');
```

### 2. Create Sample IoT Devices
```sql
-- Insert sample IoT devices for testing
INSERT INTO iot_devices (site_id, device_type, device_model, serial_number, location, status) 
SELECT 
  es.id,
  'weather_station',
  'WeatherPro 3000',
  'WP3000-' || generate_random_uuid()::text,
  ST_SetSRID(ST_MakePoint(
    ST_X(es.location) + (random() - 0.5) * 0.01,
    ST_Y(es.location) + (random() - 0.5) * 0.01
  ), 4326),
  'active'
FROM exploration_sites es
LIMIT 5;
```

## 🔐 Security Configuration

### 1. Row Level Security Verification
```sql
-- Test RLS policies
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "test-user-id"}';

-- Should return only user's data
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM spectral_data;
SELECT COUNT(*) FROM iot_devices;
```

### 2. API Security
```sql
-- Create service role for edge functions
INSERT INTO auth.users (id, email, role) VALUES 
('service-user-id', 'service@geovision.ai', 'service_role');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
```

### 3. Rate Limiting Configuration
```sql
-- Set up rate limiting for API endpoints
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  endpoint VARCHAR(100),
  requests_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 📱 Real-time Features Setup

### 1. Enable Realtime on New Tables
```sql
-- Enable realtime for critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE anomaly_detections;
ALTER PUBLICATION supabase_realtime ADD TABLE equipment_health;
ALTER PUBLICATION supabase_realtime ADD TABLE collaboration_sessions;
```

### 2. Configure Realtime Filters
```javascript
// Frontend realtime subscription example
const subscription = supabase
  .channel('anomalies')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'anomaly_detections',
    filter: 'severity=eq.critical'
  }, handleCriticalAnomaly)
  .subscribe()
```

## 🧪 Testing and Validation

### 1. Function Testing
```bash
# Test AI analysis function
curl -X POST 'https://your-project.supabase.co/functions/v1/ai-mineral-analysis' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "spectralDataId": "test-spectral-id",
    "analysisType": "mineral_detection"
  }'

# Test anomaly detection
curl -X POST 'https://your-project.supabase.co/functions/v1/realtime-anomaly-detection' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "sourceType": "sensor",
    "sourceId": "test-sensor-id",
    "dataPoints": [{"reading_type": "temperature", "value": 85}]
  }'
```

### 2. Database Performance Testing
```sql
-- Test query performance on large datasets
EXPLAIN ANALYZE SELECT * FROM sensor_readings 
WHERE device_id = 'test-device' 
AND timestamp > NOW() - INTERVAL '24 hours';

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## 📈 Monitoring and Observability

### 1. Set Up Monitoring Queries
```sql
-- Create monitoring views
CREATE VIEW system_health AS
SELECT 
  'database' as component,
  CASE WHEN pg_database_size(current_database()) < 10737418240 THEN 'healthy' ELSE 'warning' END as status,
  pg_size_pretty(pg_database_size(current_database())) as size
UNION ALL
SELECT 
  'active_connections' as component,
  CASE WHEN count(*) < 80 THEN 'healthy' ELSE 'warning' END as status,
  count(*)::text as size
FROM pg_stat_activity
WHERE state = 'active';

-- Monitor function performance
CREATE VIEW function_performance AS
SELECT 
  function_name,
  AVG(execution_time_ms) as avg_execution_time,
  COUNT(*) as total_calls,
  MAX(execution_time_ms) as max_execution_time
FROM function_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name;
```

### 2. Set Up Alerts
```sql
-- Create alert triggers
CREATE OR REPLACE FUNCTION check_critical_anomalies()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    -- Send immediate notification
    PERFORM net.http_post(
      url := 'https://your-notification-service.com/alert',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := json_build_object(
        'type', 'critical_anomaly',
        'description', NEW.description,
        'location', ST_AsText(NEW.location)
      )::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER critical_anomaly_alert
  AFTER INSERT ON anomaly_detections
  FOR EACH ROW
  EXECUTE FUNCTION check_critical_anomalies();
```

## 🔄 Backup and Recovery

### 1. Automated Backups
```bash
# Set up automated database backups
supabase db dump --file backup-$(date +%Y%m%d).sql

# Schedule regular backups (add to cron)
0 2 * * * /usr/local/bin/supabase db dump --file /backups/geovision-$(date +\%Y\%m\%d).sql
```

### 2. Data Recovery Procedures
```sql
-- Create point-in-time recovery points
SELECT pg_create_restore_point('before_major_update');

-- Test data recovery
CREATE TABLE sensor_readings_backup AS SELECT * FROM sensor_readings;
```

## 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] All migrations tested in staging
- [ ] Edge functions deployed and tested
- [ ] Environment variables configured
- [ ] RLS policies verified
- [ ] Performance benchmarks established
- [ ] Monitoring and alerting configured
- [ ] Backup procedures tested

### Post-Deployment
- [ ] Verify all functions are responding
- [ ] Check real-time subscriptions working
- [ ] Validate data integrity
- [ ] Monitor performance metrics
- [ ] Test critical user workflows
- [ ] Verify security configurations
- [ ] Document any issues or optimizations needed

### Rollback Plan
- [ ] Database migration rollback scripts prepared
- [ ] Previous function versions tagged
- [ ] Data backup verified
- [ ] Rollback procedures documented
- [ ] Team notification plan ready

## 📞 Support and Maintenance

### Regular Maintenance Tasks
- **Daily**: Monitor system health, check critical alerts
- **Weekly**: Review performance metrics, update commodity prices
- **Monthly**: Generate ESG reports, review security logs
- **Quarterly**: Performance optimization, capacity planning

### Troubleshooting Common Issues
1. **High Database Load**: Check slow queries, optimize indexes
2. **Function Timeouts**: Increase timeout limits, optimize code
3. **Real-time Connection Issues**: Check WebSocket limits, restart channels
4. **Storage Issues**: Clean up old files, optimize storage usage

This deployment guide ensures a robust, scalable, and secure implementation of the enhanced GeoVision AI Miner platform.