import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnomalyDetectionRequest {
  sourceType: 'sensor' | 'spectral' | 'drone' | 'satellite';
  sourceId: string;
  dataPoints: any[];
  thresholds?: Record<string, number>;
}

interface AnomalyResult {
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    description: string;
    location?: [number, number];
    timestamp: string;
  }>;
  overallRiskScore: number;
  recommendations: string[];
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

    const { sourceType, sourceId, dataPoints, thresholds }: AnomalyDetectionRequest = await req.json()

    // Perform anomaly detection based on source type
    let anomalyResult: AnomalyResult

    switch (sourceType) {
      case 'sensor':
        anomalyResult = await detectSensorAnomalies(dataPoints, thresholds)
        break
      case 'spectral':
        anomalyResult = await detectSpectralAnomalies(dataPoints, thresholds)
        break
      case 'drone':
        anomalyResult = await detectDroneAnomalies(dataPoints, thresholds)
        break
      case 'satellite':
        anomalyResult = await detectSatelliteAnomalies(dataPoints, thresholds)
        break
      default:
        throw new Error(`Unsupported source type: ${sourceType}`)
    }

    // Store detected anomalies
    const anomalyInserts = anomalyResult.anomalies.map(anomaly => ({
      source_type: sourceType,
      source_id: sourceId,
      anomaly_type: anomaly.type,
      severity: anomaly.severity,
      confidence_score: anomaly.confidence,
      description: anomaly.description,
      location: anomaly.location ? `POINT(${anomaly.location[0]} ${anomaly.location[1]})` : null,
      detected_at: anomaly.timestamp
    }))

    if (anomalyInserts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('anomaly_detections')
        .insert(anomalyInserts)

      if (insertError) {
        console.error('Failed to store anomalies:', insertError)
      }

      // Send real-time notifications for critical anomalies
      const criticalAnomalies = anomalyResult.anomalies.filter(a => a.severity === 'critical')
      if (criticalAnomalies.length > 0) {
        await sendCriticalAnomalyAlerts(supabaseClient, sourceId, criticalAnomalies)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        anomaliesDetected: anomalyResult.anomalies.length,
        overallRiskScore: anomalyResult.overallRiskScore,
        anomalies: anomalyResult.anomalies,
        recommendations: anomalyResult.recommendations
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

async function detectSensorAnomalies(dataPoints: any[], thresholds?: Record<string, number>): Promise<AnomalyResult> {
  const anomalies = []
  let riskScore = 0

  // Temperature anomaly detection
  const tempReadings = dataPoints.filter(d => d.reading_type === 'temperature')
  if (tempReadings.length > 0) {
    const avgTemp = tempReadings.reduce((sum, r) => sum + r.value, 0) / tempReadings.length
    const tempThreshold = thresholds?.temperature || 35 // Celsius
    
    if (avgTemp > tempThreshold) {
      anomalies.push({
        type: 'temperature_spike',
        severity: avgTemp > tempThreshold + 10 ? 'critical' : 'high',
        confidence: 0.92,
        description: `Temperature anomaly detected: ${avgTemp.toFixed(1)}°C (threshold: ${tempThreshold}°C)`,
        timestamp: new Date().toISOString()
      })
      riskScore += 25
    }
  }

  // Seismic activity detection
  const seismicReadings = dataPoints.filter(d => d.reading_type === 'seismic_activity')
  if (seismicReadings.length > 0) {
    const maxSeismic = Math.max(...seismicReadings.map(r => r.value))
    const seismicThreshold = thresholds?.seismic || 2.0 // Richter scale
    
    if (maxSeismic > seismicThreshold) {
      anomalies.push({
        type: 'seismic_event',
        severity: maxSeismic > 4.0 ? 'critical' : 'high',
        confidence: 0.88,
        description: `Seismic event detected: magnitude ${maxSeismic.toFixed(1)}`,
        timestamp: new Date().toISOString()
      })
      riskScore += 40
    }
  }

  // Water quality anomalies
  const phReadings = dataPoints.filter(d => d.reading_type === 'ph_level')
  if (phReadings.length > 0) {
    const avgPh = phReadings.reduce((sum, r) => sum + r.value, 0) / phReadings.length
    
    if (avgPh < 6.0 || avgPh > 8.5) {
      anomalies.push({
        type: 'water_quality',
        severity: (avgPh < 5.0 || avgPh > 9.0) ? 'high' : 'medium',
        confidence: 0.85,
        description: `Water pH anomaly: ${avgPh.toFixed(2)} (normal range: 6.0-8.5)`,
        timestamp: new Date().toISOString()
      })
      riskScore += 15
    }
  }

  const recommendations = generateRecommendations(anomalies)

  return {
    anomalies,
    overallRiskScore: Math.min(riskScore, 100),
    recommendations
  }
}

async function detectSpectralAnomalies(dataPoints: any[], thresholds?: Record<string, number>): Promise<AnomalyResult> {
  const anomalies = []
  let riskScore = 0

  // Simulate spectral anomaly detection
  // In production, this would analyze hyperspectral data for unusual mineral signatures
  
  // Unusual mineral concentration
  if (Math.random() > 0.7) {
    anomalies.push({
      type: 'unusual_mineral_signature',
      severity: 'medium',
      confidence: 0.76,
      description: 'Detected unusual mineral signature in spectral data - potential new mineralization',
      location: [Math.random() * 1000, Math.random() * 1000],
      timestamp: new Date().toISOString()
    })
    riskScore += 20
  }

  // Contamination detection
  if (Math.random() > 0.8) {
    anomalies.push({
      type: 'contamination_signature',
      severity: 'high',
      confidence: 0.89,
      description: 'Potential contamination detected in spectral analysis',
      location: [Math.random() * 1000, Math.random() * 1000],
      timestamp: new Date().toISOString()
    })
    riskScore += 35
  }

  return {
    anomalies,
    overallRiskScore: Math.min(riskScore, 100),
    recommendations: generateRecommendations(anomalies)
  }
}

async function detectDroneAnomalies(dataPoints: any[], thresholds?: Record<string, number>): Promise<AnomalyResult> {
  const anomalies = []
  let riskScore = 0

  // Simulate drone data anomaly detection
  // Vegetation stress detection
  if (Math.random() > 0.6) {
    anomalies.push({
      type: 'vegetation_stress',
      severity: 'medium',
      confidence: 0.82,
      description: 'Vegetation stress patterns detected - possible environmental impact',
      location: [Math.random() * 1000, Math.random() * 1000],
      timestamp: new Date().toISOString()
    })
    riskScore += 15
  }

  // Structural changes
  if (Math.random() > 0.85) {
    anomalies.push({
      type: 'structural_change',
      severity: 'high',
      confidence: 0.91,
      description: 'Significant structural changes detected in terrain',
      location: [Math.random() * 1000, Math.random() * 1000],
      timestamp: new Date().toISOString()
    })
    riskScore += 30
  }

  return {
    anomalies,
    overallRiskScore: Math.min(riskScore, 100),
    recommendations: generateRecommendations(anomalies)
  }
}

async function detectSatelliteAnomalies(dataPoints: any[], thresholds?: Record<string, number>): Promise<AnomalyResult> {
  const anomalies = []
  let riskScore = 0

  // Simulate satellite data anomaly detection
  // Land use changes
  if (Math.random() > 0.7) {
    anomalies.push({
      type: 'land_use_change',
      severity: 'low',
      confidence: 0.74,
      description: 'Land use changes detected in satellite imagery',
      location: [Math.random() * 1000, Math.random() * 1000],
      timestamp: new Date().toISOString()
    })
    riskScore += 10
  }

  return {
    anomalies,
    overallRiskScore: Math.min(riskScore, 100),
    recommendations: generateRecommendations(anomalies)
  }
}

function generateRecommendations(anomalies: any[]): string[] {
  const recommendations = []

  if (anomalies.some(a => a.type === 'temperature_spike')) {
    recommendations.push('Investigate heat sources and check equipment cooling systems')
  }

  if (anomalies.some(a => a.type === 'seismic_event')) {
    recommendations.push('Review seismic safety protocols and consider temporary operations suspension')
  }

  if (anomalies.some(a => a.type === 'water_quality')) {
    recommendations.push('Conduct detailed water quality analysis and review environmental controls')
  }

  if (anomalies.some(a => a.type === 'contamination_signature')) {
    recommendations.push('Immediate environmental assessment and containment measures required')
  }

  if (anomalies.some(a => a.severity === 'critical')) {
    recommendations.push('Immediate response team deployment recommended')
  }

  return recommendations
}

async function sendCriticalAnomalyAlerts(supabaseClient: any, sourceId: string, criticalAnomalies: any[]) {
  // In production, this would send real-time notifications via WebSocket, email, SMS, etc.
  console.log(`CRITICAL ALERT: ${criticalAnomalies.length} critical anomalies detected for source ${sourceId}`)
  
  // You could integrate with notification services here:
  // - Send WebSocket messages to connected clients
  // - Send emails via SendGrid/AWS SES
  // - Send SMS via Twilio
  // - Push notifications to mobile apps
}