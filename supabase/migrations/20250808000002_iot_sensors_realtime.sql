-- IoT Sensors and Real-time Data Processing
-- IoT Device Management
CREATE TABLE iot_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL, -- 'weather_station', 'seismic_sensor', 'water_quality', 'air_quality'
    device_model VARCHAR(100),
    serial_number VARCHAR(100) UNIQUE,
    installation_date TIMESTAMPTZ,
    location GEOMETRY(POINT, 4326),
    elevation DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'maintenance', 'error'
    battery_level DECIMAL(5,2),
    last_communication TIMESTAMPTZ,
    configuration JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time Sensor Data
CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES iot_devices(id) ON DELETE CASCADE,
    reading_type VARCHAR(50) NOT NULL, -- 'temperature', 'humidity', 'seismic_activity', 'ph_level'
    value DECIMAL(15,6),
    unit VARCHAR(20),
    quality_flag VARCHAR(20) DEFAULT 'good', -- 'good', 'suspect', 'bad', 'missing'
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition sensor_readings by month for performance
SELECT create_hypertable('sensor_readings', 'timestamp', chunk_time_interval => INTERVAL '1 month');

-- Environmental Monitoring
CREATE TABLE environmental_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    data_source VARCHAR(50) NOT NULL, -- 'satellite', 'ground_station', 'drone', 'manual'
    parameter VARCHAR(50) NOT NULL, -- 'vegetation_index', 'water_quality', 'soil_contamination'
    value DECIMAL(15,6),
    unit VARCHAR(20),
    measurement_date TIMESTAMPTZ,
    location GEOMETRY(POINT, 4326),
    confidence_level DECIMAL(5,2),
    regulatory_threshold DECIMAL(15,6),
    compliance_status VARCHAR(20), -- 'compliant', 'warning', 'violation'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drone Operations and Data
CREATE TABLE drone_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    mission_name VARCHAR(200),
    mission_type VARCHAR(50) NOT NULL, -- 'survey', 'mapping', 'monitoring', 'inspection'
    flight_plan JSONB, -- Waypoints and flight parameters
    planned_start TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    pilot_id UUID REFERENCES auth.users(id),
    drone_model VARCHAR(100),
    weather_conditions JSONB,
    flight_status VARCHAR(20) DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'aborted'
    data_collected JSONB, -- Types and amounts of data collected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drone Collected Data
CREATE TABLE drone_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES drone_missions(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL, -- 'rgb_imagery', 'multispectral', 'lidar', 'thermal'
    file_path TEXT,
    file_size_mb DECIMAL(10,2),
    capture_timestamp TIMESTAMPTZ,
    location GEOMETRY(POINT, 4326),
    altitude DECIMAL(10,2),
    camera_settings JSONB,
    processing_status VARCHAR(20) DEFAULT 'raw', -- 'raw', 'processing', 'processed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automated Anomaly Detection
CREATE TABLE anomaly_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) NOT NULL, -- 'sensor', 'spectral', 'drone', 'satellite'
    source_id UUID, -- References various source tables
    anomaly_type VARCHAR(50) NOT NULL, -- 'geological', 'environmental', 'equipment', 'safety'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    confidence_score DECIMAL(5,4),
    description TEXT,
    location GEOMETRY(POINT, 4326),
    detected_at TIMESTAMPTZ,
    investigation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'false_positive'
    assigned_to UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Predictive Maintenance
CREATE TABLE equipment_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_type VARCHAR(100) NOT NULL, -- 'drill_rig', 'excavator', 'pump', 'generator'
    equipment_id VARCHAR(100),
    site_id UUID REFERENCES exploration_sites(id) ON DELETE CASCADE,
    health_score DECIMAL(5,2), -- 0-100 health percentage
    predicted_failure_date TIMESTAMPTZ,
    maintenance_recommendations JSONB,
    sensor_data JSONB, -- Latest sensor readings
    usage_hours DECIMAL(10,2),
    last_maintenance TIMESTAMPTZ,
    next_scheduled_maintenance TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'operational', -- 'operational', 'warning', 'critical', 'offline'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE iot_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE environmental_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drone_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_health ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage IoT devices for their sites" ON iot_devices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exploration_sites es
            JOIN projects p ON p.id = es.project_id
            WHERE es.id = iot_devices.site_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can view sensor readings for their devices" ON sensor_readings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM iot_devices d
            JOIN exploration_sites es ON es.id = d.site_id
            JOIN projects p ON p.id = es.project_id
            WHERE d.id = sensor_readings.device_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage drone missions for their sites" ON drone_missions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM exploration_sites es
            JOIN projects p ON p.id = es.project_id
            WHERE es.id = drone_missions.site_id
            AND p.created_by = auth.uid()
        )
    );

-- Indexes for time-series queries
CREATE INDEX idx_sensor_readings_device_time ON sensor_readings(device_id, timestamp DESC);
CREATE INDEX idx_sensor_readings_type_time ON sensor_readings(reading_type, timestamp DESC);
CREATE INDEX idx_environmental_data_site_date ON environmental_data(site_id, measurement_date DESC);
CREATE INDEX idx_anomaly_detections_severity_status ON anomaly_detections(severity, investigation_status);
CREATE INDEX idx_equipment_health_site_status ON equipment_health(site_id, status);

-- Spatial indexes
CREATE INDEX idx_iot_devices_location ON iot_devices USING GIST(location);
CREATE INDEX idx_environmental_data_location ON environmental_data USING GIST(location);
CREATE INDEX idx_drone_data_location ON drone_data USING GIST(location);