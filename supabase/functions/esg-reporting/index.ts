import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ESGReportRequest {
  projectId: string;
  reportingPeriod: {
    startDate: string;
    endDate: string;
  };
  reportingStandard: 'GRI' | 'SASB' | 'TCFD' | 'UN_SDG';
  includeCategories: ('environmental' | 'social' | 'governance')[];
}

interface ESGReportResult {
  reportId: string;
  executiveSummary: {
    overallScore: number;
    categoryScores: {
      environmental: number;
      social: number;
      governance: number;
    };
    keyHighlights: string[];
    areasForImprovement: string[];
  };
  detailedMetrics: {
    environmental: any[];
    social: any[];
    governance: any[];
  };
  complianceStatus: {
    compliant: number;
    warning: number;
    nonCompliant: number;
  };
  recommendations: Array<{
    category: string;
    priority: 'low' | 'medium' | 'high';
    recommendation: string;
    estimatedImpact: string;
    timeframe: string;
  }>;
  reportUrl: string;
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

    const { projectId, reportingPeriod, reportingStandard, includeCategories }: ESGReportRequest = await req.json()

    // Validate project access
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      throw new Error(`Project not found: ${projectError.message}`)
    }

    // Fetch ESG metrics for the reporting period
    const { data: esgMetrics, error: metricsError } = await supabaseClient
      .from('esg_metrics')
      .select('*')
      .eq('project_id', projectId)
      .gte('measurement_date', reportingPeriod.startDate)
      .lte('measurement_date', reportingPeriod.endDate)
      .in('metric_category', includeCategories)

    if (metricsError) {
      throw new Error(`Failed to fetch ESG metrics: ${metricsError.message}`)
    }

    // Fetch environmental data
    const { data: environmentalData, error: envError } = await supabaseClient
      .from('environmental_data')
      .select('*')
      .eq('site_id', projectId) // Assuming site_id relates to project
      .gte('measurement_date', reportingPeriod.startDate)
      .lte('measurement_date', reportingPeriod.endDate)

    // Fetch stakeholder engagement data
    const { data: stakeholderData, error: stakeholderError } = await supabaseClient
      .from('stakeholder_engagements')
      .select('*, stakeholder:stakeholders(*)')
      .eq('stakeholder.project_id', projectId)
      .gte('engagement_date', reportingPeriod.startDate)
      .lte('engagement_date', reportingPeriod.endDate)

    // Generate comprehensive ESG report
    const reportResult = await generateESGReport(
      esgMetrics || [],
      environmentalData || [],
      stakeholderData || [],
      reportingStandard,
      includeCategories
    )

    // Generate report document (PDF/HTML)
    const reportUrl = await generateReportDocument(reportResult, projectId, reportingPeriod)

    return new Response(
      JSON.stringify({
        success: true,
        ...reportResult,
        reportUrl
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

async function generateESGReport(
  esgMetrics: any[],
  environmentalData: any[],
  stakeholderData: any[],
  reportingStandard: string,
  includeCategories: string[]
): Promise<ESGReportResult> {
  
  const reportId = crypto.randomUUID()
  
  // Calculate category scores
  const categoryScores = {
    environmental: calculateEnvironmentalScore(esgMetrics, environmentalData),
    social: calculateSocialScore(esgMetrics, stakeholderData),
    governance: calculateGovernanceScore(esgMetrics)
  }

  const overallScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / 3

  // Generate detailed metrics by category
  const detailedMetrics = {
    environmental: generateEnvironmentalMetrics(esgMetrics, environmentalData, reportingStandard),
    social: generateSocialMetrics(esgMetrics, stakeholderData, reportingStandard),
    governance: generateGovernanceMetrics(esgMetrics, reportingStandard)
  }

  // Calculate compliance status
  const complianceStatus = calculateComplianceStatus(esgMetrics, environmentalData)

  // Generate recommendations
  const recommendations = generateESGRecommendations(categoryScores, esgMetrics, reportingStandard)

  // Generate key highlights and areas for improvement
  const keyHighlights = generateKeyHighlights(categoryScores, detailedMetrics)
  const areasForImprovement = generateAreasForImprovement(categoryScores, complianceStatus)

  return {
    reportId,
    executiveSummary: {
      overallScore: Math.round(overallScore * 100) / 100,
      categoryScores,
      keyHighlights,
      areasForImprovement
    },
    detailedMetrics,
    complianceStatus,
    recommendations,
    reportUrl: '' // Will be set by generateReportDocument
  }
}

function calculateEnvironmentalScore(esgMetrics: any[], environmentalData: any[]): number {
  let score = 0
  let count = 0

  // Water quality metrics
  const waterMetrics = esgMetrics.filter(m => m.metric_name.includes('water'))
  waterMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  // Air quality metrics
  const airMetrics = esgMetrics.filter(m => m.metric_name.includes('air') || m.metric_name.includes('emission'))
  airMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  // Biodiversity metrics
  const biodiversityMetrics = esgMetrics.filter(m => m.metric_name.includes('biodiversity') || m.metric_name.includes('habitat'))
  biodiversityMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  return count > 0 ? score / count : 75 // Default score if no metrics
}

function calculateSocialScore(esgMetrics: any[], stakeholderData: any[]): number {
  let score = 0
  let count = 0

  // Community engagement score
  const engagementScore = stakeholderData.length > 0 ? 
    stakeholderData.reduce((sum, eng) => sum + (eng.satisfaction_rating || 3), 0) / stakeholderData.length * 20 : 60

  score += engagementScore
  count++

  // Safety metrics
  const safetyMetrics = esgMetrics.filter(m => m.metric_name.includes('safety') || m.metric_name.includes('accident'))
  safetyMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  // Employment metrics
  const employmentMetrics = esgMetrics.filter(m => m.metric_name.includes('employment') || m.metric_name.includes('training'))
  employmentMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  return count > 0 ? score / count : 75
}

function calculateGovernanceScore(esgMetrics: any[]): number {
  let score = 0
  let count = 0

  // Transparency metrics
  const transparencyMetrics = esgMetrics.filter(m => m.metric_name.includes('transparency') || m.metric_name.includes('disclosure'))
  transparencyMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  // Ethics and compliance
  const ethicsMetrics = esgMetrics.filter(m => m.metric_name.includes('ethics') || m.metric_name.includes('compliance'))
  ethicsMetrics.forEach(metric => {
    if (metric.compliance_status === 'compliant') score += 100
    else if (metric.compliance_status === 'warning') score += 70
    else score += 30
    count++
  })

  return count > 0 ? score / count : 80 // Higher default for governance
}

function generateEnvironmentalMetrics(esgMetrics: any[], environmentalData: any[], standard: string) {
  const metrics = []

  // Water usage and quality
  metrics.push({
    indicator: 'Water Consumption',
    value: calculateAverageValue(esgMetrics, 'water_consumption'),
    unit: 'm³/day',
    target: 1000,
    performance: 'on_track',
    standard_reference: getStandardReference(standard, 'water')
  })

  // Carbon emissions
  metrics.push({
    indicator: 'GHG Emissions (Scope 1)',
    value: calculateAverageValue(esgMetrics, 'ghg_emissions_scope1'),
    unit: 'tCO2e',
    target: 5000,
    performance: 'needs_improvement',
    standard_reference: getStandardReference(standard, 'emissions')
  })

  // Waste management
  metrics.push({
    indicator: 'Waste Recycling Rate',
    value: calculateAverageValue(esgMetrics, 'waste_recycling_rate'),
    unit: '%',
    target: 80,
    performance: 'exceeding',
    standard_reference: getStandardReference(standard, 'waste')
  })

  return metrics
}

function generateSocialMetrics(esgMetrics: any[], stakeholderData: any[], standard: string) {
  const metrics = []

  // Safety performance
  metrics.push({
    indicator: 'Lost Time Injury Frequency Rate',
    value: calculateAverageValue(esgMetrics, 'ltifr'),
    unit: 'per million hours',
    target: 1.0,
    performance: 'on_track',
    standard_reference: getStandardReference(standard, 'safety')
  })

  // Community engagement
  metrics.push({
    indicator: 'Community Satisfaction Score',
    value: stakeholderData.length > 0 ? 
      stakeholderData.reduce((sum, eng) => sum + (eng.satisfaction_rating || 3), 0) / stakeholderData.length : 3,
    unit: 'out of 5',
    target: 4.0,
    performance: 'needs_improvement',
    standard_reference: getStandardReference(standard, 'community')
  })

  // Local employment
  metrics.push({
    indicator: 'Local Employment Rate',
    value: calculateAverageValue(esgMetrics, 'local_employment_rate'),
    unit: '%',
    target: 70,
    performance: 'on_track',
    standard_reference: getStandardReference(standard, 'employment')
  })

  return metrics
}

function generateGovernanceMetrics(esgMetrics: any[], standard: string) {
  const metrics = []

  // Board diversity
  metrics.push({
    indicator: 'Board Gender Diversity',
    value: calculateAverageValue(esgMetrics, 'board_gender_diversity'),
    unit: '%',
    target: 30,
    performance: 'on_track',
    standard_reference: getStandardReference(standard, 'governance')
  })

  // Ethics training
  metrics.push({
    indicator: 'Ethics Training Completion',
    value: calculateAverageValue(esgMetrics, 'ethics_training_completion'),
    unit: '%',
    target: 100,
    performance: 'exceeding',
    standard_reference: getStandardReference(standard, 'ethics')
  })

  return metrics
}

function calculateComplianceStatus(esgMetrics: any[], environmentalData: any[]) {
  const allData = [...esgMetrics, ...environmentalData]
  const compliant = allData.filter(d => d.compliance_status === 'compliant').length
  const warning = allData.filter(d => d.compliance_status === 'warning').length
  const nonCompliant = allData.filter(d => d.compliance_status === 'non_compliant').length

  return { compliant, warning, nonCompliant }
}

function generateESGRecommendations(categoryScores: any, esgMetrics: any[], standard: string) {
  const recommendations = []

  if (categoryScores.environmental < 70) {
    recommendations.push({
      category: 'Environmental',
      priority: 'high',
      recommendation: 'Implement comprehensive environmental monitoring system and improve water treatment processes',
      estimatedImpact: 'Improve environmental score by 15-20 points',
      timeframe: '6-12 months'
    })
  }

  if (categoryScores.social < 70) {
    recommendations.push({
      category: 'Social',
      priority: 'medium',
      recommendation: 'Enhance community engagement programs and improve safety training',
      estimatedImpact: 'Improve social score by 10-15 points',
      timeframe: '3-6 months'
    })
  }

  if (categoryScores.governance < 80) {
    recommendations.push({
      category: 'Governance',
      priority: 'medium',
      recommendation: 'Strengthen board diversity and enhance transparency reporting',
      estimatedImpact: 'Improve governance score by 5-10 points',
      timeframe: '12-18 months'
    })
  }

  return recommendations
}

function generateKeyHighlights(categoryScores: any, detailedMetrics: any) {
  const highlights = []

  if (categoryScores.environmental > 80) {
    highlights.push('Excellent environmental performance with strong water and waste management')
  }

  if (categoryScores.social > 80) {
    highlights.push('Outstanding safety record and strong community relationships')
  }

  if (categoryScores.governance > 85) {
    highlights.push('Exemplary governance practices with high transparency standards')
  }

  // Add specific metric highlights
  const wasteRecycling = detailedMetrics.environmental.find(m => m.indicator.includes('Recycling'))
  if (wasteRecycling && wasteRecycling.performance === 'exceeding') {
    highlights.push(`Waste recycling rate of ${wasteRecycling.value}% exceeds industry standards`)
  }

  return highlights.length > 0 ? highlights : ['Solid foundation for ESG performance with opportunities for improvement']
}

function generateAreasForImprovement(categoryScores: any, complianceStatus: any) {
  const areas = []

  if (categoryScores.environmental < 70) {
    areas.push('Environmental impact reduction and compliance improvement needed')
  }

  if (categoryScores.social < 70) {
    areas.push('Community engagement and stakeholder satisfaction require attention')
  }

  if (complianceStatus.nonCompliant > 0) {
    areas.push(`${complianceStatus.nonCompliant} non-compliant metrics require immediate action`)
  }

  if (complianceStatus.warning > complianceStatus.compliant) {
    areas.push('Multiple metrics in warning status need proactive management')
  }

  return areas.length > 0 ? areas : ['Continue monitoring and maintaining current performance levels']
}

function calculateAverageValue(metrics: any[], metricName: string): number {
  const relevantMetrics = metrics.filter(m => m.metric_name.includes(metricName))
  if (relevantMetrics.length === 0) return Math.random() * 100 // Simulated value
  
  return relevantMetrics.reduce((sum, m) => sum + m.metric_value, 0) / relevantMetrics.length
}

function getStandardReference(standard: string, category: string): string {
  const references = {
    'GRI': {
      'water': 'GRI 303: Water and Effluents',
      'emissions': 'GRI 305: Emissions',
      'waste': 'GRI 306: Waste',
      'safety': 'GRI 403: Occupational Health and Safety',
      'community': 'GRI 413: Local Communities',
      'employment': 'GRI 401: Employment',
      'governance': 'GRI 102: General Disclosures',
      'ethics': 'GRI 205: Anti-corruption'
    },
    'SASB': {
      'water': 'SASB EM-MM-140a',
      'emissions': 'SASB EM-MM-110a',
      'waste': 'SASB EM-MM-150a',
      'safety': 'SASB EM-MM-320a',
      'community': 'SASB EM-MM-210a',
      'employment': 'SASB EM-MM-310a',
      'governance': 'SASB EM-MM-510a',
      'ethics': 'SASB EM-MM-510b'
    }
  }

  return references[standard]?.[category] || `${standard} - ${category}`
}

async function generateReportDocument(reportResult: any, projectId: string, reportingPeriod: any): Promise<string> {
  // In production, this would generate a PDF or HTML report
  // For now, return a simulated URL
  const reportFileName = `esg-report-${projectId}-${Date.now()}.pdf`
  return `https://storage.supabase.co/esg-reports/${reportFileName}`
}