import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalysisRequest {
  spectralDataId: string;
  analysisType: 'mineral_detection' | 'grade_estimation' | 'geological_classification';
  modelVersion?: string;
}

interface MineralDetectionResult {
  minerals: Array<{
    name: string;
    confidence: number;
    abundance: number;
    location: [number, number]; // pixel coordinates
  }>;
  overallConfidence: number;
  processingTime: number;
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

    const { spectralDataId, analysisType, modelVersion = 'latest' }: AnalysisRequest = await req.json()

    // Get spectral data
    const { data: spectralData, error: spectralError } = await supabaseClient
      .from('spectral_data')
      .select('*')
      .eq('id', spectralDataId)
      .single()

    if (spectralError) {
      throw new Error(`Failed to fetch spectral data: ${spectralError.message}`)
    }

    // Get the appropriate AI model
    const { data: model, error: modelError } = await supabaseClient
      .from('ai_model_versions')
      .select('*')
      .eq('model_type', analysisType)
      .eq('deployment_status', 'deployed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (modelError) {
      throw new Error(`No deployed model found for ${analysisType}`)
    }

    // Simulate AI processing (in production, this would call actual ML models)
    const startTime = Date.now()
    
    let analysisResult: any
    
    switch (analysisType) {
      case 'mineral_detection':
        analysisResult = await performMineralDetection(spectralData, model)
        break
      case 'grade_estimation':
        analysisResult = await performGradeEstimation(spectralData, model)
        break
      case 'geological_classification':
        analysisResult = await performGeologicalClassification(spectralData, model)
        break
      default:
        throw new Error(`Unsupported analysis type: ${analysisType}`)
    }

    const processingTime = Date.now() - startTime

    // Generate feature vector for similarity search
    const featureVector = generateFeatureVector(analysisResult)

    // Store analysis results
    const { data: cvResult, error: cvError } = await supabaseClient
      .from('cv_analysis_results')
      .insert({
        spectral_data_id: spectralDataId,
        analysis_type: analysisType,
        detected_features: analysisResult,
        confidence_map_url: `https://storage.supabase.co/confidence-maps/${spectralDataId}-${Date.now()}.png`,
        feature_vectors: featureVector,
        processing_time_seconds: Math.round(processingTime / 1000),
        model_version: model.version
      })
      .select()
      .single()

    if (cvError) {
      throw new Error(`Failed to store analysis results: ${cvError.message}`)
    }

    // Update spectral data processing status
    await supabaseClient
      .from('spectral_data')
      .update({ processing_status: 'analyzed' })
      .eq('id', spectralDataId)

    return new Response(
      JSON.stringify({
        success: true,
        analysisId: cvResult.id,
        results: analysisResult,
        processingTime,
        modelVersion: model.version
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

async function performMineralDetection(spectralData: any, model: any): Promise<MineralDetectionResult> {
  // Simulate mineral detection AI processing
  const minerals = [
    { name: 'Quartz', confidence: 0.92, abundance: 0.45, location: [150, 200] },
    { name: 'Feldspar', confidence: 0.87, abundance: 0.32, location: [300, 150] },
    { name: 'Pyrite', confidence: 0.78, abundance: 0.12, location: [450, 300] },
    { name: 'Chalcopyrite', confidence: 0.65, abundance: 0.08, location: [200, 400] }
  ]

  return {
    minerals,
    overallConfidence: 0.81,
    processingTime: 2.3
  }
}

async function performGradeEstimation(spectralData: any, model: any) {
  return {
    estimatedGrade: 2.45, // g/t gold equivalent
    confidence: 0.73,
    gradeDistribution: {
      min: 1.2,
      max: 4.8,
      mean: 2.45,
      stdDev: 0.8
    },
    spatialVariability: 'moderate'
  }
}

async function performGeologicalClassification(spectralData: any, model: any) {
  return {
    rockType: 'Granodiorite',
    confidence: 0.89,
    alteration: {
      type: 'Propylitic',
      intensity: 'moderate',
      confidence: 0.76
    },
    structuralFeatures: [
      { type: 'fracture', orientation: 'NE-SW', confidence: 0.82 },
      { type: 'vein', width: 0.5, confidence: 0.67 }
    ]
  }
}

function generateFeatureVector(analysisResult: any): number[] {
  // Generate a 512-dimensional feature vector for similarity search
  // In production, this would be generated by the actual ML model
  return Array.from({ length: 512 }, () => Math.random() * 2 - 1)
}