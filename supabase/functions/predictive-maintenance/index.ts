import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MaintenanceRequest {
  equipmentId: string;
  sensorData: {
    vibration?: number;
    temperature?: number;
    pressure?: number;
    runtime_hours?: number;
    load_factor?: number;
  };
  maintenanceHistory: Array<{
    date: string;
    type: string;
    cost: number;
    parts_replaced: string[];
  }>;
}

interface MaintenanceResult {
  healthScore: number; // 0-100
  predictedFailureDate: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high' | 'urgent';
    action: string;
    estimatedCost: number;
    timeframe: string;
  }>;
  nextMaintenanceDate: string;
  costSavings: {
    preventiveCost: number;
    reactiveRepairCost: number;
    potentialSavings: number;
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

    const { equipmentId, sensorData, maintenanceHistory }: MaintenanceRequest = await req.json()

    // Perform predictive maintenance analysis
    const analysisResult = await performPredictiveAnalysis(sensorData, maintenanceHistory)

    // Update equipment health record
    const { error: updateError } = await supabaseClient
      .from('equipment_health')
      .upsert({
        equipment_id: equipmentId,
        health_score: analysisResult.healthScore,
        predicted_failure_date: analysisResult.predictedFailureDate,
        maintenance_recommendations: analysisResult.recommendations,
        sensor_data: sensorData,
        next_scheduled_maintenance: analysisResult.nextMaintenanceDate,
        status: getEquipmentStatus(analysisResult.healthScore),
        updated_at: new Date().toISOString()
      })

    if (updateError) {
      console.error('Failed to update equipment health:', updateError)
    }

    // Create maintenance alerts for critical equipment
    if (analysisResult.riskLevel === 'critical') {
      await createMaintenanceAlert(supabaseClient, equipmentId, analysisResult)
    }

    return new Response(
      JSON.stringify({
        success: true,
        equipmentId,
        healthScore: analysisResult.healthScore,
        riskLevel: analysisResult.riskLevel,
        predictedFailureDate: analysisResult.predictedFailureDate,
        recommendations: analysisResult.recommendations,
        costSavings: analysisResult.costSavings
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

async function performPredictiveAnalysis(
  sensorData: any, 
  maintenanceHistory: any[]
): Promise<MaintenanceResult> {
  let healthScore = 100
  let riskFactors = []

  // Analyze vibration data
  if (sensorData.vibration) {
    if (sensorData.vibration > 10) {
      healthScore -= 20
      riskFactors.push('high_vibration')
    } else if (sensorData.vibration > 7) {
      healthScore -= 10
      riskFactors.push('elevated_vibration')
    }
  }

  // Analyze temperature data
  if (sensorData.temperature) {
    if (sensorData.temperature > 80) {
      healthScore -= 25
      riskFactors.push('overheating')
    } else if (sensorData.temperature > 70) {
      healthScore -= 15
      riskFactors.push('high_temperature')
    }
  }

  // Analyze runtime hours
  if (sensorData.runtime_hours) {
    const hoursThreshold = 8760 // 1 year
    if (sensorData.runtime_hours > hoursThreshold * 2) {
      healthScore -= 30
      riskFactors.push('excessive_runtime')
    } else if (sensorData.runtime_hours > hoursThreshold) {
      healthScore -= 15
      riskFactors.push('high_runtime')
    }
  }

  // Analyze maintenance history
  const recentMaintenance = maintenanceHistory.filter(m => 
    new Date(m.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
  )

  if (recentMaintenance.length === 0) {
    healthScore -= 20
    riskFactors.push('overdue_maintenance')
  }

  // Calculate failure prediction
  let predictedFailureDate = null
  if (healthScore < 50) {
    const daysToFailure = Math.max(30, (healthScore / 100) * 365)
    predictedFailureDate = new Date(Date.now() + daysToFailure * 24 * 60 * 60 * 1000).toISOString()
  }

  // Generate recommendations
  const recommendations = generateMaintenanceRecommendations(riskFactors, healthScore)

  // Calculate next maintenance date
  const nextMaintenanceDate = calculateNextMaintenanceDate(healthScore, maintenanceHistory)

  // Calculate cost savings
  const costSavings = calculateCostSavings(healthScore, recommendations)

  return {
    healthScore: Math.max(0, healthScore),
    predictedFailureDate,
    riskLevel: getRiskLevel(healthScore),
    recommendations,
    nextMaintenanceDate,
    costSavings
  }
}

function generateMaintenanceRecommendations(riskFactors: string[], healthScore: number) {
  const recommendations = []

  if (riskFactors.includes('high_vibration') || riskFactors.includes('elevated_vibration')) {
    recommendations.push({
      priority: riskFactors.includes('high_vibration') ? 'urgent' : 'high',
      action: 'Inspect and balance rotating components, check bearing condition',
      estimatedCost: 2500,
      timeframe: riskFactors.includes('high_vibration') ? '1-2 days' : '1 week'
    })
  }

  if (riskFactors.includes('overheating') || riskFactors.includes('high_temperature')) {
    recommendations.push({
      priority: riskFactors.includes('overheating') ? 'urgent' : 'high',
      action: 'Clean cooling systems, check coolant levels, inspect heat exchangers',
      estimatedCost: 1800,
      timeframe: riskFactors.includes('overheating') ? 'immediate' : '2-3 days'
    })
  }

  if (riskFactors.includes('excessive_runtime') || riskFactors.includes('high_runtime')) {
    recommendations.push({
      priority: 'medium',
      action: 'Schedule comprehensive inspection and component replacement',
      estimatedCost: 5000,
      timeframe: '2 weeks'
    })
  }

  if (riskFactors.includes('overdue_maintenance')) {
    recommendations.push({
      priority: 'high',
      action: 'Perform scheduled preventive maintenance immediately',
      estimatedCost: 3000,
      timeframe: '3-5 days'
    })
  }

  if (healthScore < 30) {
    recommendations.push({
      priority: 'urgent',
      action: 'Consider equipment replacement or major overhaul',
      estimatedCost: 25000,
      timeframe: '1 month'
    })
  }

  return recommendations
}

function calculateNextMaintenanceDate(healthScore: number, maintenanceHistory: any[]): string {
  const baseInterval = 90 // days
  let adjustedInterval = baseInterval

  // Adjust interval based on health score
  if (healthScore < 50) {
    adjustedInterval = 30 // More frequent maintenance for poor health
  } else if (healthScore < 70) {
    adjustedInterval = 60
  }

  // Consider last maintenance date
  const lastMaintenance = maintenanceHistory
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]

  const baseDate = lastMaintenance ? new Date(lastMaintenance.date) : new Date()
  
  return new Date(baseDate.getTime() + adjustedInterval * 24 * 60 * 60 * 1000).toISOString()
}

function calculateCostSavings(healthScore: number, recommendations: any[]) {
  const preventiveCost = recommendations.reduce((sum, rec) => sum + rec.estimatedCost, 0)
  
  // Estimate reactive repair cost (typically 3-5x higher)
  const reactiveRepairCost = preventiveCost * 4
  
  // Calculate potential savings based on health score
  const failureProbability = (100 - healthScore) / 100
  const potentialSavings = (reactiveRepairCost - preventiveCost) * failureProbability

  return {
    preventiveCost,
    reactiveRepairCost,
    potentialSavings: Math.round(potentialSavings)
  }
}

function getRiskLevel(healthScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (healthScore >= 80) return 'low'
  if (healthScore >= 60) return 'medium'
  if (healthScore >= 40) return 'high'
  return 'critical'
}

function getEquipmentStatus(healthScore: number): string {
  if (healthScore >= 80) return 'operational'
  if (healthScore >= 60) return 'warning'
  if (healthScore >= 40) return 'critical'
  return 'offline'
}

async function createMaintenanceAlert(supabaseClient: any, equipmentId: string, analysisResult: any) {
  await supabaseClient
    .from('anomaly_detections')
    .insert({
      source_type: 'equipment',
      source_id: equipmentId,
      anomaly_type: 'equipment',
      severity: 'critical',
      confidence_score: 0.95,
      description: `Critical equipment health detected: ${analysisResult.healthScore}% health score`,
      investigation_status: 'pending',
      detected_at: new Date().toISOString()
    })
}