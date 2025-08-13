import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeologicalAnalysisRequest {
  analysisType: 'core_interpretation' | 'spectral_analysis' | 'risk_assessment' | 'esg_report' | 'anomaly_explanation';
  data: {
    coreData?: any[];
    spectralData?: any[];
    sensorReadings?: any[];
    geologicalContext?: string;
    safetyParameters?: any;
  };
  context: {
    projectId: string;
    siteLocation: string;
    geologicalSetting: string;
    targetMinerals: string[];
    safetyRequirements: string[];
  };
}

interface LLMResponse {
  analysis: string;
  confidence: number;
  recommendations: string[];
  riskFactors: string[];
  followUpActions: string[];
  technicalDetails: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { analysisType, data, context }: GeologicalAnalysisRequest = await req.json()

    // Route to appropriate LLM based on analysis type
    let llmResponse: LLMResponse

    switch (analysisType) {
      case 'core_interpretation':
        llmResponse = await analyzeWithClaude(buildCoreAnalysisPrompt(data, context))
        break
      case 'spectral_analysis':
        llmResponse = await analyzeWithClaude(buildSpectralAnalysisPrompt(data, context))
        break
      case 'risk_assessment':
        llmResponse = await analyzeWithClaude(buildRiskAssessmentPrompt(data, context))
        break
      case 'esg_report':
        llmResponse = await analyzeWithGPT4(buildESGReportPrompt(data, context))
        break
      case 'anomaly_explanation':
        llmResponse = await analyzeWithClaude(buildAnomalyExplanationPrompt(data, context))
        break
      default:
        throw new Error(`Unsupported analysis type: ${analysisType}`)
    }

    // Store LLM analysis results
    const { data: analysisRecord, error: storeError } = await supabaseClient
      .from('llm_analysis_results')
      .insert({
        analysis_type: analysisType,
        project_id: context.projectId,
        input_data: data,
        llm_response: llmResponse,
        confidence_score: llmResponse.confidence,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (storeError) {
      console.error('Failed to store LLM analysis:', storeError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysisId: analysisRecord?.id,
        analysis: llmResponse.analysis,
        confidence: llmResponse.confidence,
        recommendations: llmResponse.recommendations,
        riskFactors: llmResponse.riskFactors,
        followUpActions: llmResponse.followUpActions,
        technicalDetails: llmResponse.technicalDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

async function analyzeWithClaude(prompt: string): Promise<LLMResponse> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for technical accuracy
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.statusText}`)
  }

  const result = await response.json()
  return parseClaudeResponse(result.content[0].text)
}

async function analyzeWithGPT4(prompt: string): Promise<LLMResponse> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert geological consultant specializing in mining operations, environmental compliance, and stakeholder communication.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`)
  }

  const result = await response.json()
  return parseGPTResponse(result.choices[0].message.content)
}

function buildCoreAnalysisPrompt(data: any, context: any): string {
  return `
As an expert geological consultant, analyze the following drill core data for mining exploration:

**Project Context:**
- Location: ${context.siteLocation}
- Geological Setting: ${context.geologicalSetting}
- Target Minerals: ${context.targetMinerals.join(', ')}
- Safety Requirements: ${context.safetyRequirements.join(', ')}

**Core Sample Data:**
${JSON.stringify(data.coreData, null, 2)}

**Analysis Required:**
1. Lithological interpretation and rock type classification
2. Mineralization assessment and grade estimation potential
3. Structural geology interpretation (fractures, veins, alteration)
4. Geotechnical considerations for mining operations
5. Environmental and safety risk factors
6. Recommendations for further exploration

**Output Format:**
Provide your analysis in JSON format with the following structure:
{
  "analysis": "Detailed geological interpretation",
  "confidence": 0.85,
  "recommendations": ["Specific actionable recommendations"],
  "riskFactors": ["Identified geological and operational risks"],
  "followUpActions": ["Next steps for exploration"],
  "technicalDetails": {
    "lithology": "Primary rock types identified",
    "mineralization": "Mineral assemblages and potential grades",
    "structure": "Structural features and orientations",
    "geotechnical": "Rock quality and stability assessment"
  }
}

Focus on technical accuracy, safety considerations, and practical mining implications.
`
}

function buildSpectralAnalysisPrompt(data: any, context: any): string {
  return `
As an expert in remote sensing and mineral spectroscopy, analyze the following hyperspectral/multispectral data:

**Project Context:**
- Location: ${context.siteLocation}
- Geological Setting: ${context.geologicalSetting}
- Target Minerals: ${context.targetMinerals.join(', ')}

**Spectral Data:**
${JSON.stringify(data.spectralData, null, 2)}

**Analysis Required:**
1. Mineral identification from spectral signatures
2. Alteration mapping and intensity assessment
3. Confidence levels for each mineral detection
4. Spatial distribution patterns
5. Comparison with known mineral spectral libraries
6. Recommendations for ground-truthing

Provide detailed technical analysis focusing on spectral absorption features, mineral assemblages, and exploration implications.
`
}

function buildRiskAssessmentPrompt(data: any, context: any): string {
  return `
As a mining risk assessment specialist, evaluate the following operational and geological data:

**Project Context:**
- Location: ${context.siteLocation}
- Safety Requirements: ${context.safetyRequirements.join(', ')}

**Risk Data:**
- Sensor Readings: ${JSON.stringify(data.sensorReadings, null, 2)}
- Geological Context: ${data.geologicalContext}

**Assessment Required:**
1. Geological hazard assessment (slope stability, seismic risk, groundwater)
2. Operational safety risks (equipment, personnel, environmental)
3. Environmental compliance risks
4. Economic and market risks
5. Regulatory and social license risks
6. Risk mitigation strategies and contingency planning

Prioritize safety-critical risks and provide actionable mitigation measures.
`
}

function buildESGReportPrompt(data: any, context: any): string {
  return `
As an ESG (Environmental, Social, Governance) specialist for mining operations, create a comprehensive sustainability analysis:

**Project Context:**
- Location: ${context.siteLocation}
- Project ID: ${context.projectId}

**ESG Data:**
${JSON.stringify(data, null, 2)}

**Report Requirements:**
1. Environmental impact assessment and compliance status
2. Social license to operate and community engagement
3. Governance practices and transparency measures
4. Stakeholder satisfaction and engagement metrics
5. Regulatory compliance and reporting standards
6. Improvement recommendations and action plans

Focus on clear communication suitable for stakeholders, investors, and regulatory bodies.
`
}

function buildAnomalyExplanationPrompt(data: any, context: any): string {
  return `
As a geological and mining operations expert, explain the following detected anomalies:

**Project Context:**
- Location: ${context.siteLocation}
- Geological Setting: ${context.geologicalSetting}
- Safety Requirements: ${context.safetyRequirements.join(', ')}

**Anomaly Data:**
${JSON.stringify(data, null, 2)}

**Explanation Required:**
1. Root cause analysis of detected anomalies
2. Geological or operational significance
3. Potential impact on mining operations
4. Safety implications and immediate actions required
5. Long-term monitoring recommendations
6. Similar historical cases and lessons learned

Provide clear, actionable explanations that help operations teams understand and respond appropriately.
`
}

function parseClaudeResponse(content: string): LLMResponse {
  try {
    // Try to extract JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Failed to parse Claude JSON response:', error)
  }

  // Fallback: parse structured text response
  return {
    analysis: content,
    confidence: 0.75,
    recommendations: extractListItems(content, 'recommendations'),
    riskFactors: extractListItems(content, 'risk'),
    followUpActions: extractListItems(content, 'action'),
    technicalDetails: { rawResponse: content }
  }
}

function parseGPTResponse(content: string): LLMResponse {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('Failed to parse GPT JSON response:', error)
  }

  return {
    analysis: content,
    confidence: 0.75,
    recommendations: extractListItems(content, 'recommend'),
    riskFactors: extractListItems(content, 'risk'),
    followUpActions: extractListItems(content, 'action'),
    technicalDetails: { rawResponse: content }
  }
}

function extractListItems(text: string, keyword: string): string[] {
  const lines = text.split('\n')
  const items = []
  
  for (const line of lines) {
    if (line.toLowerCase().includes(keyword) && (line.includes('-') || line.includes('•') || line.includes('1.'))) {
      items.push(line.trim().replace(/^[-•\d.]\s*/, ''))
    }
  }
  
  return items.slice(0, 5) // Limit to 5 items
}