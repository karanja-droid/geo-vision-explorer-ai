import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ModelingRequest {
  projectId: string;
  modelType: 'ore_body' | 'structural' | 'lithological' | 'grade_shell';
  inputData: {
    drillHoles?: any[];
    samples?: any[];
    geologicalContacts?: any[];
    structuralData?: any[];
  };
  parameters: {
    interpolationMethod: 'kriging' | 'idw' | 'nearest_neighbor';
    resolution: number; // meters
    confidenceThreshold: number;
    boundingBox: {
      minX: number;
      minY: number;
      minZ: number;
      maxX: number;
      maxY: number;
      maxZ: number;
    };
  };
}

interface ModelingResult {
  modelId: string;
  modelUrl: string;
  statistics: {
    totalVolume: number;
    averageGrade?: number;
    tonnage?: number;
    confidenceLevel: number;
  };
  validationMetrics: {
    crossValidationScore: number;
    rmse: number;
    mae: number;
  };
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

    const { projectId, modelType, inputData, parameters }: ModelingRequest = await req.json()

    // Validate project access
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      throw new Error(`Project not found: ${projectError.message}`)
    }

    // Perform 3D geological modeling
    const modelingResult = await perform3DModeling(modelType, inputData, parameters)

    // Generate model file (in production, this would create actual 3D model files)
    const modelFileName = `${projectId}_${modelType}_${Date.now()}.gltf`
    const modelUrl = `https://storage.supabase.co/3d-models/${modelFileName}`

    // Store model metadata in database
    const { data: modelRecord, error: modelError } = await supabaseClient
      .from('geological_models_3d')
      .insert({
        project_id: projectId,
        model_name: `${modelType.replace('_', ' ').toUpperCase()} Model - ${new Date().toLocaleDateString()}`,
        model_type: modelType,
        model_data_url: modelUrl,
        model_format: 'gltf',
        bounding_box: parameters.boundingBox,
        resolution: parameters.resolution,
        interpolation_method: parameters.interpolationMethod,
        confidence_level: modelingResult.statistics.confidenceLevel
      })
      .select()
      .single()

    if (modelError) {
      throw new Error(`Failed to store model: ${modelError.message}`)
    }

    // Store geostatistical analysis results
    await supabaseClient
      .from('geostatistical_analysis')
      .insert({
        project_id: projectId,
        analysis_type: parameters.interpolationMethod,
        target_variable: modelType === 'grade_shell' ? 'grade' : 'lithology',
        input_data_points: getTotalDataPoints(inputData),
        variogram_model: generateVariogramModel(parameters.interpolationMethod),
        kriging_parameters: parameters.interpolationMethod === 'kriging' ? generateKrigingParameters() : null,
        estimation_variance: modelingResult.validationMetrics.rmse ** 2,
        cross_validation_results: modelingResult.validationMetrics,
        results_url: modelUrl
      })

    return new Response(
      JSON.stringify({
        success: true,
        modelId: modelRecord.id,
        modelUrl: modelUrl,
        statistics: modelingResult.statistics,
        validationMetrics: modelingResult.validationMetrics,
        processingTime: modelingResult.processingTime
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

async function perform3DModeling(
  modelType: string, 
  inputData: any, 
  parameters: any
): Promise<ModelingResult & { processingTime: number }> {
  const startTime = Date.now()

  // Simulate 3D geological modeling process
  // In production, this would use actual geological modeling algorithms
  
  let statistics: any = {
    confidenceLevel: 0.75 + Math.random() * 0.2 // 75-95% confidence
  }

  switch (modelType) {
    case 'ore_body':
      statistics = {
        ...statistics,
        totalVolume: Math.random() * 1000000 + 100000, // cubic meters
        averageGrade: Math.random() * 5 + 1, // g/t
        tonnage: Math.random() * 500000 + 50000 // tonnes
      }
      break
      
    case 'grade_shell':
      statistics = {
        ...statistics,
        totalVolume: Math.random() * 2000000 + 200000,
        averageGrade: Math.random() * 3 + 0.5,
        tonnage: Math.random() * 800000 + 100000
      }
      break
      
    case 'structural':
      statistics = {
        ...statistics,
        totalVolume: Math.random() * 5000000 + 500000,
        structuralComplexity: Math.random() > 0.5 ? 'high' : 'moderate'
      }
      break
      
    case 'lithological':
      statistics = {
        ...statistics,
        totalVolume: Math.random() * 3000000 + 300000,
        dominantLithology: ['granite', 'schist', 'quartzite', 'gneiss'][Math.floor(Math.random() * 4)]
      }
      break
  }

  // Simulate validation metrics
  const validationMetrics = {
    crossValidationScore: 0.7 + Math.random() * 0.25, // 70-95%
    rmse: Math.random() * 0.5 + 0.1, // Root Mean Square Error
    mae: Math.random() * 0.3 + 0.05 // Mean Absolute Error
  }

  const processingTime = Date.now() - startTime

  return {
    modelId: crypto.randomUUID(),
    modelUrl: '', // Will be set by caller
    statistics,
    validationMetrics,
    processingTime
  }
}

function getTotalDataPoints(inputData: any): number {
  let total = 0
  if (inputData.drillHoles) total += inputData.drillHoles.length
  if (inputData.samples) total += inputData.samples.length
  if (inputData.geologicalContacts) total += inputData.geologicalContacts.length
  if (inputData.structuralData) total += inputData.structuralData.length
  return total
}

function generateVariogramModel(interpolationMethod: string): any {
  if (interpolationMethod !== 'kriging') return null
  
  return {
    model_type: ['spherical', 'exponential', 'gaussian'][Math.floor(Math.random() * 3)],
    nugget: Math.random() * 0.1,
    sill: Math.random() * 2 + 0.5,
    range: Math.random() * 500 + 100,
    anisotropy: {
      ratio: Math.random() * 0.5 + 0.5,
      angle: Math.random() * 180
    }
  }
}

function generateKrigingParameters(): any {
  return {
    kriging_type: 'ordinary',
    search_radius: Math.random() * 200 + 50,
    min_samples: Math.floor(Math.random() * 5) + 3,
    max_samples: Math.floor(Math.random() * 10) + 15,
    sector_search: {
      enabled: Math.random() > 0.5,
      sectors: Math.random() > 0.5 ? 4 : 8,
      min_per_sector: 1,
      max_per_sector: 3
    }
  }
}