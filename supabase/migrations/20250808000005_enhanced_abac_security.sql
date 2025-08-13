-- Enhanced ABAC (Attribute-Based Access Control) for Mining Operations
-- Data Fabric Operations Tracking
CREATE TABLE data_fabric_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type VARCHAR(50) NOT NULL, -- 'convert_to_cog', 'build_stac_catalog', 'generate_geology_mvt'
    input_data JSONB NOT NULL,
    output_result JSONB,
    processing_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'completed', -- 'processing', 'completed', 'failed'
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Organization and Jurisdiction Management
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    organization_type VARCHAR(50) NOT NULL, -- 'mining_company', 'exploration', 'consultant', 'government'
    headquarters_country VARCHAR(3), -- ISO 3166-1 alpha-3
    operating_jurisdictions TEXT[], -- Array of country codes
    data_classification_level INTEGER DEFAULT 1, -- 1=public, 2=internal, 3=confidential, 4=restricted
    compliance_requirements JSONB, -- Regulatory requirements by jurisdiction
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Organization Membership with Attributes
CREATE TABLE user_organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'admin', 'geologist', 'manager', 'viewer'
    clearance_level INTEGER DEFAULT 1, -- Data classification access level
    jurisdiction_access TEXT[], -- Countries user can access data for
    project_access_level INTEGER DEFAULT 1, -- 1=public, 2=internal, 3=sensitive, 4=classified
    attributes JSONB, -- Additional ABAC attributes
    is_active BOOLEAN DEFAULT true,
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Project Classification
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(3); -- ISO country code
ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_classification INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_sensitivity INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS regulatory_requirements JSONB;

-- Immutable Audit Log (WORM - Write Once Read Many)
CREATE TABLE immutable_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL, -- 'data_access', 'data_modification', 'user_action', 'system_event'
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID REFERENCES organizations(id),
    resource_type VARCHAR(50), -- 'project', 'site', 'spectral_data', 'core_sample'
    resource_id UUID,
    action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', 'export', 'share'
    details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    jurisdiction VARCHAR(3),
    data_classification INTEGER,
    hash_chain VARCHAR(64), -- SHA-256 hash linking to previous record
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Immutable: no updates or deletes allowed
    CONSTRAINT no_updates CHECK (false) DEFERRABLE INITIALLY DEFERRED
);

-- Disable updates and deletes on audit log
CREATE RULE no_update_audit_log AS ON UPDATE TO immutable_audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_log AS ON DELETE TO immutable_audit_log DO INSTEAD NOTHING;

-- Hash chain function for tamper evidence
CREATE OR REPLACE FUNCTION generate_audit_hash_chain()
RETURNS TRIGGER AS $$
DECLARE
    previous_hash VARCHAR(64);
    current_data TEXT;
BEGIN
    -- Get the hash from the most recent audit record
    SELECT hash_chain INTO previous_hash
    FROM immutable_audit_log
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- If no previous record, use a genesis hash
    IF previous_hash IS NULL THEN
        previous_hash := 'genesis_hash_geovision_audit_log';
    END IF;
    
    -- Create data string for hashing
    current_data := NEW.event_type || NEW.user_id::text || NEW.action || 
                   NEW.details::text || NEW.timestamp::text || previous_hash;
    
    -- Generate SHA-256 hash (simulated - in production use pgcrypto)
    NEW.hash_chain := encode(digest(current_data, 'sha256'), 'hex');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for hash chain generation
CREATE TRIGGER audit_hash_chain_trigger
    BEFORE INSERT ON immutable_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION generate_audit_hash_chain();

-- Anomalous Access Detection
CREATE TABLE access_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    resource_type VARCHAR(50),
    access_count INTEGER DEFAULT 1,
    last_access TIMESTAMPTZ DEFAULT NOW(),
    typical_access_hours INTEGER[], -- Hours of day user typically accesses
    typical_locations INET[], -- IP ranges user typically accesses from
    risk_score DECIMAL(5,2) DEFAULT 0, -- 0-100 risk score
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, resource_type)
);

-- Function to detect anomalous access
CREATE OR REPLACE FUNCTION detect_anomalous_access()
RETURNS TRIGGER AS $$
DECLARE
    current_hour INTEGER;
    user_pattern RECORD;
    risk_score DECIMAL(5,2) := 0;
    is_anomalous BOOLEAN := false;
BEGIN
    current_hour := EXTRACT(HOUR FROM NOW());
    
    -- Get user's typical access pattern
    SELECT * INTO user_pattern
    FROM access_patterns
    WHERE user_id = NEW.user_id
    AND resource_type = NEW.resource_type;
    
    IF user_pattern IS NOT NULL THEN
        -- Check time-based anomaly
        IF NOT (current_hour = ANY(user_pattern.typical_access_hours)) THEN
            risk_score := risk_score + 25;
            is_anomalous := true;
        END IF;
        
        -- Check location-based anomaly (simplified)
        IF NEW.ip_address IS NOT NULL AND 
           NOT (NEW.ip_address <<= ANY(user_pattern.typical_locations)) THEN
            risk_score := risk_score + 35;
            is_anomalous := true;
        END IF;
        
        -- Check frequency anomaly
        IF user_pattern.access_count > 100 AND 
           (NOW() - user_pattern.last_access) < INTERVAL '1 minute' THEN
            risk_score := risk_score + 40;
            is_anomalous := true;
        END IF;
        
        -- Update access pattern
        UPDATE access_patterns
        SET access_count = access_count + 1,
            last_access = NOW(),
            risk_score = GREATEST(risk_score, user_pattern.risk_score),
            updated_at = NOW()
        WHERE id = user_pattern.id;
    ELSE
        -- First access - create pattern
        INSERT INTO access_patterns (
            user_id, resource_type, typical_access_hours, 
            typical_locations, risk_score
        ) VALUES (
            NEW.user_id, NEW.resource_type, 
            ARRAY[current_hour], 
            ARRAY[NEW.ip_address], 
            0
        );
    END IF;
    
    -- Create alert for high-risk access
    IF risk_score > 50 THEN
        INSERT INTO anomaly_detections (
            source_type, source_id, anomaly_type, severity,
            confidence_score, description, detected_at
        ) VALUES (
            'access_pattern', NEW.user_id, 'security',
            CASE WHEN risk_score > 80 THEN 'critical'
                 WHEN risk_score > 60 THEN 'high'
                 ELSE 'medium' END,
            risk_score / 100,
            'Anomalous access pattern detected: risk score ' || risk_score,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for anomaly detection
CREATE TRIGGER detect_access_anomaly_trigger
    AFTER INSERT ON immutable_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION detect_anomalous_access();

-- Enhanced RLS Policies with ABAC
-- Drop existing basic RLS policies and replace with ABAC

-- Projects ABAC Policy
DROP POLICY IF EXISTS "Users can only see their own projects" ON projects;
CREATE POLICY "projects_abac_policy" ON projects
FOR ALL USING (
    -- User must be member of project's organization
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.organization_id = projects.organization_id
        AND uom.is_active = true
        AND (uom.expires_at IS NULL OR uom.expires_at > NOW())
    )
    AND
    -- User must have jurisdiction access
    (
        projects.jurisdiction IS NULL OR
        EXISTS (
            SELECT 1 FROM user_organization_memberships uom
            WHERE uom.user_id = auth.uid()
            AND uom.organization_id = projects.organization_id
            AND projects.jurisdiction = ANY(uom.jurisdiction_access)
        )
    )
    AND
    -- User must have sufficient clearance level
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.organization_id = projects.organization_id
        AND uom.clearance_level >= COALESCE(projects.data_classification, 1)
    )
    AND
    -- User must have sufficient project access level
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.organization_id = projects.organization_id
        AND uom.project_access_level >= COALESCE(projects.project_sensitivity, 1)
    )
);

-- Spectral Data ABAC Policy
CREATE POLICY "spectral_data_abac_policy" ON spectral_data
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM exploration_sites es
        JOIN projects p ON p.id = es.project_id
        JOIN user_organization_memberships uom ON uom.organization_id = p.organization_id
        WHERE es.id = spectral_data.site_id
        AND uom.user_id = auth.uid()
        AND uom.is_active = true
        AND (uom.expires_at IS NULL OR uom.expires_at > NOW())
        AND uom.clearance_level >= COALESCE(p.data_classification, 1)
        AND uom.project_access_level >= COALESCE(p.project_sensitivity, 1)
        AND (p.jurisdiction IS NULL OR p.jurisdiction = ANY(uom.jurisdiction_access))
    )
);

-- Core Samples ABAC Policy
CREATE POLICY "core_samples_abac_policy" ON core_samples
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM exploration_sites es
        JOIN projects p ON p.id = es.project_id
        JOIN user_organization_memberships uom ON uom.organization_id = p.organization_id
        WHERE es.id = core_samples.site_id
        AND uom.user_id = auth.uid()
        AND uom.is_active = true
        AND (uom.expires_at IS NULL OR uom.expires_at > NOW())
        AND uom.clearance_level >= COALESCE(p.data_classification, 1)
        AND uom.project_access_level >= COALESCE(p.project_sensitivity, 1)
        AND (p.jurisdiction IS NULL OR p.jurisdiction = ANY(uom.jurisdiction_access))
    )
);

-- Enable RLS on new tables
ALTER TABLE data_fabric_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE immutable_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables
CREATE POLICY "users_can_view_their_org_operations" ON data_fabric_operations
FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.role IN ('admin', 'manager')
    )
);

CREATE POLICY "users_can_view_their_organizations" ON organizations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.organization_id = organizations.id
    )
);

CREATE POLICY "users_can_view_audit_logs_for_their_orgs" ON immutable_audit_log
FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
        AND uom.organization_id = immutable_audit_log.organization_id
        AND uom.role IN ('admin', 'manager')
    )
);

-- Indexes for ABAC performance
CREATE INDEX idx_user_org_memberships_user_org ON user_organization_memberships(user_id, organization_id);
CREATE INDEX idx_user_org_memberships_active ON user_organization_memberships(user_id, is_active, expires_at);
CREATE INDEX idx_projects_org_jurisdiction ON projects(organization_id, jurisdiction);
CREATE INDEX idx_audit_log_user_timestamp ON immutable_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_log_org_timestamp ON immutable_audit_log(organization_id, timestamp DESC);
CREATE INDEX idx_access_patterns_user_resource ON access_patterns(user_id, resource_type);

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_entry(
    p_event_type VARCHAR(50),
    p_resource_type VARCHAR(50),
    p_resource_id UUID,
    p_action VARCHAR(50),
    p_details JSONB
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
    user_org_id UUID;
    user_jurisdiction VARCHAR(3);
    data_class INTEGER;
BEGIN
    -- Get user's organization and jurisdiction
    SELECT uom.organization_id, p.jurisdiction, p.data_classification
    INTO user_org_id, user_jurisdiction, data_class
    FROM user_organization_memberships uom
    LEFT JOIN projects p ON p.organization_id = uom.organization_id
    WHERE uom.user_id = auth.uid()
    AND uom.is_active = true
    LIMIT 1;
    
    -- Insert audit record
    INSERT INTO immutable_audit_log (
        event_type, user_id, organization_id, resource_type,
        resource_id, action, details, ip_address, user_agent,
        jurisdiction, data_classification
    ) VALUES (
        p_event_type, auth.uid(), user_org_id, p_resource_type,
        p_resource_id, p_action, p_details, 
        inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent',
        user_jurisdiction, data_class
    ) RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample organizations for testing
INSERT INTO organizations (name, organization_type, headquarters_country, operating_jurisdictions, data_classification_level) VALUES
('GeoVision Mining Corp', 'mining_company', 'CAN', ARRAY['CAN', 'USA', 'AUS'], 3),
('Exploration Services Ltd', 'exploration', 'AUS', ARRAY['AUS', 'PNG', 'IDN'], 2),
('Geological Consultants Inc', 'consultant', 'USA', ARRAY['USA', 'MEX', 'CHL'], 2),
('Mining Authority', 'government', 'CAN', ARRAY['CAN'], 4);