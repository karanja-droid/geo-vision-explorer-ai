-- LLM Integration and Analysis Results
-- Store LLM analysis results and conversation history
CREATE TABLE llm_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_type VARCHAR(50) NOT NULL, -- 'core_interpretation', 'spectral_analysis', 'risk_assessment', 'esg_report', 'anomaly_explanation'
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    input_data JSONB NOT NULL, -- Original data sent to LLM
    llm_response JSONB NOT NULL, -- Full LLM response
    llm_model VARCHAR(50) NOT NULL DEFAULT 'claude-3-5-sonnet', -- 'claude-3-5-sonnet', 'gpt-4-turbo', etc.
    confidence_score DECIMAL(5,4), -- Overall confidence in analysis
    processing_time_ms INTEGER, -- Time taken for LLM processing
    token_usage JSONB, -- Token consumption details
    human_feedback JSONB, -- User feedback on analysis quality
    validation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'validated', 'rejected', 'needs_review'
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM conversation history for context
CREATE TABLE llm_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    conversation_type VARCHAR(50) NOT NULL, -- 'geological_consultation', 'risk_analysis', 'report_generation'
    messages JSONB NOT NULL, -- Array of conversation messages
    context_data JSONB, -- Relevant project/site data for context
    total_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,4) DEFAULT 0,
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' -- 'active', 'completed', 'archived'
);

-- LLM model performance tracking
CREATE TABLE llm_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(50) NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    average_confidence DECIMAL(5,4),
    average_processing_time_ms INTEGER,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,2) DEFAULT 0,
    user_satisfaction_avg DECIMAL(3,2), -- Average user rating 1-5
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_name, analysis_type)
);

-- Geological knowledge base for LLM context
CREATE TABLE geological_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    knowledge_type VARCHAR(50) NOT NULL, -- 'mineral_properties', 'geological_formations', 'mining_methods', 'safety_protocols'
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB, -- Additional structured data
    embedding vector(1536), -- OpenAI embedding for semantic search
    tags TEXT[], -- Searchable tags
    source VARCHAR(200), -- Reference source
    confidence_level VARCHAR(20) DEFAULT 'high', -- 'high', 'medium', 'low'
    last_verified TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM prompt templates for consistency
CREATE TABLE llm_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) UNIQUE NOT NULL,
    analysis_type VARCHAR(50) NOT NULL,
    prompt_template TEXT NOT NULL, -- Template with placeholders
    model_preference VARCHAR(50) DEFAULT 'claude-3-5-sonnet',
    temperature DECIMAL(3,2) DEFAULT 0.1,
    max_tokens INTEGER DEFAULT 4000,
    system_message TEXT,
    example_inputs JSONB, -- Example input data for testing
    expected_output_format JSONB, -- Expected response structure
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback on LLM analyses
CREATE TABLE llm_analysis_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES llm_analysis_results(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
    feedback_type VARCHAR(50) NOT NULL, -- 'accuracy', 'usefulness', 'clarity', 'completeness'
    comments TEXT,
    suggested_improvements TEXT,
    would_use_again BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE llm_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE geological_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_analysis_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view LLM analyses for their projects" ON llm_analysis_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = llm_analysis_results.project_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can create LLM analyses for their projects" ON llm_analysis_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = llm_analysis_results.project_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage their conversations" ON llm_conversations
    FOR ALL USING (
        started_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = llm_conversations.project_id
            AND p.created_by = auth.uid()
        )
    );

CREATE POLICY "Knowledge base is readable by authenticated users" ON geological_knowledge_base
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can provide feedback on analyses they can view" ON llm_analysis_feedback
    FOR ALL USING (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM llm_analysis_results lar
            JOIN projects p ON p.id = lar.project_id
            WHERE lar.id = llm_analysis_feedback.analysis_id
            AND p.created_by = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX idx_llm_analysis_project_type ON llm_analysis_results(project_id, analysis_type);
CREATE INDEX idx_llm_analysis_created_at ON llm_analysis_results(created_at DESC);
CREATE INDEX idx_llm_conversations_project ON llm_conversations(project_id, last_message_at DESC);
CREATE INDEX idx_geological_knowledge_type ON geological_knowledge_base(knowledge_type);
CREATE INDEX idx_geological_knowledge_tags ON geological_knowledge_base USING GIN(tags);
CREATE INDEX idx_llm_model_performance_model ON llm_model_performance(model_name, analysis_type);

-- Vector similarity search index for knowledge base
CREATE INDEX idx_geological_knowledge_embedding ON geological_knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Insert default prompt templates
INSERT INTO llm_prompt_templates (template_name, analysis_type, prompt_template, system_message) VALUES
(
    'core_analysis_standard',
    'core_interpretation',
    'Analyze the following drill core data for mining exploration:\n\n**Project Context:**\n- Location: {location}\n- Geological Setting: {geological_setting}\n- Target Minerals: {target_minerals}\n\n**Core Sample Data:**\n{core_data}\n\nProvide detailed geological interpretation focusing on lithology, mineralization, structure, and mining implications.',
    'You are an expert geological consultant with 20+ years of experience in mining exploration. Focus on technical accuracy, safety considerations, and practical mining implications.'
),
(
    'spectral_analysis_standard',
    'spectral_analysis',
    'Analyze the following hyperspectral/multispectral data for mineral identification:\n\n**Project Context:**\n- Location: {location}\n- Target Minerals: {target_minerals}\n\n**Spectral Data:**\n{spectral_data}\n\nProvide mineral identification, alteration mapping, and confidence assessments.',
    'You are an expert in remote sensing and mineral spectroscopy. Focus on spectral absorption features and mineral assemblages.'
),
(
    'risk_assessment_standard',
    'risk_assessment',
    'Evaluate the following operational and geological data for mining risk assessment:\n\n**Project Context:**\n- Location: {location}\n- Safety Requirements: {safety_requirements}\n\n**Risk Data:**\n{risk_data}\n\nAssess geological hazards, operational risks, environmental compliance, and provide mitigation strategies.',
    'You are a mining risk assessment specialist. Prioritize safety-critical risks and provide actionable mitigation measures.'
);

-- Insert sample geological knowledge base entries
INSERT INTO geological_knowledge_base (knowledge_type, title, content, tags, confidence_level) VALUES
(
    'mineral_properties',
    'Gold Mineralization Characteristics',
    'Gold typically occurs in quartz veins, often associated with pyrite, arsenopyrite, and other sulfide minerals. Primary indicators include: 1) Quartz veining with sulfide minerals, 2) Alteration halos (sericite, carbonate, silica), 3) Structural controls (shear zones, fault intersections), 4) Geochemical anomalies (Au, As, Sb, Te pathfinder elements).',
    ARRAY['gold', 'mineralization', 'exploration', 'geochemistry'],
    'high'
),
(
    'safety_protocols',
    'Underground Mine Ventilation Requirements',
    'Minimum ventilation requirements for underground mining: 1) Fresh air supply: 200 cfm per person, 2) Methane monitoring in coal mines, 3) CO monitoring near diesel equipment, 4) Emergency escape routes clearly marked, 5) Ventilation surveys quarterly, 6) Air quality monitoring at working faces.',
    ARRAY['safety', 'ventilation', 'underground', 'monitoring'],
    'high'
),
(
    'geological_formations',
    'Porphyry Copper Deposit Characteristics',
    'Porphyry copper deposits form in calc-alkaline igneous complexes. Key features: 1) Central intrusive stock with potassic alteration, 2) Concentric alteration zones (potassic, phyllic, argillic, propylitic), 3) Stockwork veining with chalcopyrite-pyrite-molybdenite, 4) Large tonnage, low to moderate grade (0.3-2% Cu), 5) Associated with subduction zone magmatism.',
    ARRAY['porphyry', 'copper', 'alteration', 'deposit_model'],
    'high'
);

-- Function to update model performance metrics
CREATE OR REPLACE FUNCTION update_llm_model_performance()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO llm_model_performance (
        model_name,
        analysis_type,
        total_requests,
        successful_requests,
        average_confidence,
        average_processing_time_ms,
        total_tokens_used,
        last_updated
    )
    VALUES (
        NEW.llm_model,
        NEW.analysis_type,
        1,
        CASE WHEN NEW.validation_status != 'rejected' THEN 1 ELSE 0 END,
        NEW.confidence_score,
        NEW.processing_time_ms,
        COALESCE((NEW.token_usage->>'total')::integer, 0),
        NOW()
    )
    ON CONFLICT (model_name, analysis_type)
    DO UPDATE SET
        total_requests = llm_model_performance.total_requests + 1,
        successful_requests = llm_model_performance.successful_requests + 
            CASE WHEN NEW.validation_status != 'rejected' THEN 1 ELSE 0 END,
        average_confidence = (
            llm_model_performance.average_confidence * llm_model_performance.total_requests + 
            COALESCE(NEW.confidence_score, 0)
        ) / (llm_model_performance.total_requests + 1),
        average_processing_time_ms = (
            llm_model_performance.average_processing_time_ms * llm_model_performance.total_requests + 
            COALESCE(NEW.processing_time_ms, 0)
        ) / (llm_model_performance.total_requests + 1),
        total_tokens_used = llm_model_performance.total_tokens_used + 
            COALESCE((NEW.token_usage->>'total')::integer, 0),
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update performance metrics
CREATE TRIGGER update_model_performance_trigger
    AFTER INSERT ON llm_analysis_results
    FOR EACH ROW
    EXECUTE FUNCTION update_llm_model_performance();