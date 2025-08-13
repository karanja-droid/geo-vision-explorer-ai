import { supabase } from '@/integrations/supabase/client';
import { cacheManager } from './cache-manager';

export interface MineralPrediction {
  id: string;
  mineralType: string;
  confidence: number;
  estimatedQuantity: number;
  estimatedValue: number;
  coordinates: { lat: number; lng: number };
  depth?: number;
  quality: 'low' | 'medium' | 'high' | 'premium';
  uncertainty: {
    quantityRange: { min: number; max: number };
    confidenceInterval: { lower: number; upper: number };
    riskFactors: string[];
  };
  geologicalContext: {
    rockType: string;
    formation: string;
    age: string;
    structuralFeatures: string[];
  };
  analysisMetadata: {
    modelVersion: string;
    dataSource: string;
    processingTime: number;
    inputFeatures: string[];
    timestamp: Date;
  };
}

export interface BatchAnalysisJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalSites: number;
  processedSites: number;
  results: MineralPrediction[];
  errors: Array<{ siteId: string; error: string }>;
  startTime: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
}

export interface GeologicalReport {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  sections: {
    executive: string;
    methodology: string;
    findings: string;
    recommendations: string;
    appendices: string[];
  };
  predictions: MineralPrediction[];
  charts: Array<{
    type: 'distribution' | 'confidence' | 'value' | 'timeline';
    data: any;
    config: any;
  }>;
  metadata: {
    generatedAt: Date;
    modelVersion: string;
    dataQuality: number;
    confidenceLevel: number;
  };
}

export class EnhancedAIAnalysis {
  private modelEndpoint: string;
  private apiKey: string;
  private batchJobs = new Map<string, BatchAnalysisJob>();

  constructor() {
    this.modelEndpoint = process.env.VITE_AI_MODEL_ENDPOINT || '/api/ai-analysis';
    this.apiKey = process.env.VITE_AI_API_KEY || '';
  }

  /**
   * Analyze a single geological site with enhanced AI
   */
  async analyzeSite(siteData: {
    id: string;
    coordinates: { lat: number; lng: number };
    geologicalData: any;
    geophysicalData?: any;
    geochemicalData?: any;
    historicalData?: any;
  }): Promise<MineralPrediction[]> {
    const cacheKey = `ai_analysis_${siteData.id}`;
    
    // Check cache first
    const cached = await cacheManager.get<MineralPrediction[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const startTime = performance.now();
      
      // Prepare input features
      const inputFeatures = this.prepareInputFeatures(siteData);
      
      // Call AI model
      const response = await fetch(this.modelEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          site_id: siteData.id,
          coordinates: siteData.coordinates,
          features: inputFeatures,
          analysis_type: 'comprehensive',
          include_uncertainty: true,
          include_context: true
        })
      });

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = performance.now() - startTime;

      // Transform results to our format
      const predictions = this.transformAIResults(result, siteData, processingTime);

      // Cache results
      await cacheManager.set(cacheKey, predictions, 1800); // 30 minutes

      // Store in database
      await this.storePredictions(predictions);

      return predictions;
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple sites
   */
  async batchAnalyzeSites(sites: Array<{
    id: string;
    coordinates: { lat: number; lng: number };
    geologicalData: any;
  }>): Promise<BatchAnalysisJob> {
    const jobId = crypto.randomUUID();
    
    const job: BatchAnalysisJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      totalSites: sites.length,
      processedSites: 0,
      results: [],
      errors: [],
      startTime: new Date(),
      estimatedCompletion: new Date(Date.now() + sites.length * 30000) // 30s per site estimate
    };

    this.batchJobs.set(jobId, job);

    // Process sites in background
    this.processBatchJob(job, sites);

    return job;
  }

  /**
   * Get batch job status
   */
  getBatchJobStatus(jobId: string): BatchAnalysisJob | null {
    return this.batchJobs.get(jobId) || null;
  }

  /**
   * Generate comprehensive geological report
   */
  async generateGeologicalReport(
    projectId: string,
    options: {
      includePredictions?: boolean;
      includeCharts?: boolean;
      includeRecommendations?: boolean;
      reportType?: 'summary' | 'detailed' | 'executive';
    } = {}
  ): Promise<GeologicalReport> {
    const cacheKey = `geological_report_${projectId}_${JSON.stringify(options)}`;
    
    // Check cache
    const cached = await cacheManager.get<GeologicalReport>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get project data
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          sites:sites(
            *,
            mineral_deposits:mineral_deposits(*),
            ai_predictions:ai_predictions(*)
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError) {
        throw new Error(`Failed to fetch project data: ${projectError.message}`);
      }

      // Get all predictions for the project
      const predictions = await this.getProjectPredictions(projectId);

      // Generate report using AI
      const reportData = await this.generateReportContent(project, predictions, options);

      const report: GeologicalReport = {
        id: crypto.randomUUID(),
        projectId,
        title: `Geological Analysis Report - ${project.name}`,
        summary: reportData.summary,
        sections: reportData.sections,
        predictions: options.includePredictions ? predictions : [],
        charts: options.includeCharts ? await this.generateReportCharts(predictions) : [],
        metadata: {
          generatedAt: new Date(),
          modelVersion: '2.1.0',
          dataQuality: this.calculateDataQuality(project),
          confidenceLevel: this.calculateOverallConfidence(predictions)
        }
      };

      // Cache report
      await cacheManager.set(cacheKey, report, 3600); // 1 hour

      // Store in database
      await this.storeReport(report);

      return report;
    } catch (error) {
      console.error('Report generation failed:', error);
      throw error;
    }
  }

  /**
   * Get mineral distribution analysis
   */
  async getMineralDistribution(projectId: string): Promise<{
    byType: Record<string, number>;
    byConfidence: Record<string, number>;
    byValue: Record<string, number>;
    spatialDistribution: Array<{
      coordinates: { lat: number; lng: number };
      mineralType: string;
      confidence: number;
      value: number;
    }>;
    trends: {
      mostPromising: string[];
      riskAreas: string[];
      recommendations: string[];
    };
  }> {
    const predictions = await this.getProjectPredictions(projectId);
    
    const distribution = {
      byType: {} as Record<string, number>,
      byConfidence: {} as Record<string, number>,
      byValue: {} as Record<string, number>,
      spatialDistribution: [] as Array<{
        coordinates: { lat: number; lng: number };
        mineralType: string;
        confidence: number;
        value: number;
      }>,
      trends: {
        mostPromising: [] as string[],
        riskAreas: [] as string[],
        recommendations: [] as string[]
      }
    };

    // Analyze by mineral type
    predictions.forEach(prediction => {
      distribution.byType[prediction.mineralType] = 
        (distribution.byType[prediction.mineralType] || 0) + prediction.estimatedQuantity;
      
      distribution.byValue[prediction.mineralType] = 
        (distribution.byValue[prediction.mineralType] || 0) + prediction.estimatedValue;
    });

    // Analyze by confidence levels
    predictions.forEach(prediction => {
      const confidenceRange = this.getConfidenceRange(prediction.confidence);
      distribution.byConfidence[confidenceRange] = 
        (distribution.byConfidence[confidenceRange] || 0) + 1;
    });

    // Create spatial distribution
    distribution.spatialDistribution = predictions.map(prediction => ({
      coordinates: prediction.coordinates,
      mineralType: prediction.mineralType,
      confidence: prediction.confidence,
      value: prediction.estimatedValue
    }));

    // Generate trends and recommendations
    distribution.trends = this.analyzeTrends(predictions);

    return distribution;
  }

  /**
   * Predict optimal drilling locations
   */
  async predictDrillingLocations(
    projectId: string,
    constraints: {
      budget?: number;
      maxLocations?: number;
      minConfidence?: number;
      excludeAreas?: Array<{ lat: number; lng: number; radius: number }>;
    } = {}
  ): Promise<Array<{
    coordinates: { lat: number; lng: number };
    priority: number;
    expectedValue: number;
    confidence: number;
    reasoning: string;
    estimatedCost: number;
    riskFactors: string[];
  }>> {
    const predictions = await this.getProjectPredictions(projectId);
    
    // Filter by constraints
    let filteredPredictions = predictions.filter(p => 
      p.confidence >= (constraints.minConfidence || 0.6)
    );

    // Exclude areas
    if (constraints.excludeAreas) {
      filteredPredictions = filteredPredictions.filter(prediction => {
        return !constraints.excludeAreas!.some(area => {
          const distance = this.calculateDistance(
            prediction.coordinates,
            { lat: area.lat, lng: area.lng }
          );
          return distance <= area.radius;
        });
      });
    }

    // Calculate drilling priorities
    const drillingLocations = filteredPredictions.map(prediction => {
      const priority = this.calculateDrillingPriority(prediction);
      const estimatedCost = this.estimateDrillingCost(prediction);
      
      return {
        coordinates: prediction.coordinates,
        priority,
        expectedValue: prediction.estimatedValue,
        confidence: prediction.confidence,
        reasoning: this.generateDrillingReasoning(prediction),
        estimatedCost,
        riskFactors: prediction.uncertainty.riskFactors
      };
    });

    // Sort by priority and apply budget constraints
    drillingLocations.sort((a, b) => b.priority - a.priority);

    if (constraints.budget) {
      let totalCost = 0;
      const budgetFiltered = [];
      
      for (const location of drillingLocations) {
        if (totalCost + location.estimatedCost <= constraints.budget) {
          budgetFiltered.push(location);
          totalCost += location.estimatedCost;
        }
      }
      
      return budgetFiltered.slice(0, constraints.maxLocations || 10);
    }

    return drillingLocations.slice(0, constraints.maxLocations || 10);
  }

  // Private helper methods
  private prepareInputFeatures(siteData: any): any {
    return {
      coordinates: siteData.coordinates,
      geological_features: siteData.geologicalData,
      geophysical_data: siteData.geophysicalData || {},
      geochemical_data: siteData.geochemicalData || {},
      historical_data: siteData.historicalData || {},
      elevation: siteData.elevation || 0,
      slope: siteData.slope || 0,
      aspect: siteData.aspect || 0,
      land_use: siteData.landUse || 'unknown'
    };
  }

  private transformAIResults(result: any, siteData: any, processingTime: number): MineralPrediction[] {
    return result.predictions.map((pred: any) => ({
      id: crypto.randomUUID(),
      mineralType: pred.mineral_type,
      confidence: pred.confidence,
      estimatedQuantity: pred.estimated_quantity,
      estimatedValue: pred.estimated_value,
      coordinates: siteData.coordinates,
      depth: pred.depth,
      quality: this.determineQuality(pred.confidence, pred.estimated_value),
      uncertainty: {
        quantityRange: pred.uncertainty.quantity_range,
        confidenceInterval: pred.uncertainty.confidence_interval,
        riskFactors: pred.uncertainty.risk_factors || []
      },
      geologicalContext: {
        rockType: pred.geological_context.rock_type,
        formation: pred.geological_context.formation,
        age: pred.geological_context.age,
        structuralFeatures: pred.geological_context.structural_features || []
      },
      analysisMetadata: {
        modelVersion: result.model_version,
        dataSource: 'enhanced_ai_v2',
        processingTime,
        inputFeatures: Object.keys(this.prepareInputFeatures(siteData)),
        timestamp: new Date()
      }
    }));
  }

  private async processBatchJob(job: BatchAnalysisJob, sites: any[]): Promise<void> {
    job.status = 'processing';
    
    for (let i = 0; i < sites.length; i++) {
      try {
        const predictions = await this.analyzeSite(sites[i]);
        job.results.push(...predictions);
        job.processedSites++;
        job.progress = (job.processedSites / job.totalSites) * 100;
      } catch (error) {
        job.errors.push({
          siteId: sites[i].id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    job.status = job.errors.length === 0 ? 'completed' : 'completed';
    job.endTime = new Date();
    job.progress = 100;
  }

  private async storePredictions(predictions: MineralPrediction[]): Promise<void> {
    const { error } = await supabase
      .from('ai_predictions')
      .insert(
        predictions.map(pred => ({
          id: pred.id,
          prediction_type: 'mineral_detection',
          confidence_score: pred.confidence,
          predicted_mineral_type: pred.mineralType,
          predicted_quantity: pred.estimatedQuantity,
          predicted_value: pred.estimatedValue,
          prediction_data: {
            coordinates: pred.coordinates,
            depth: pred.depth,
            quality: pred.quality,
            uncertainty: pred.uncertainty,
            geological_context: pred.geologicalContext,
            metadata: pred.analysisMetadata
          },
          created_at: new Date().toISOString()
        }))
      );

    if (error) {
      console.error('Failed to store predictions:', error);
    }
  }

  private async getProjectPredictions(projectId: string): Promise<MineralPrediction[]> {
    const { data, error } = await supabase
      .from('ai_predictions')
      .select(`
        *,
        site:sites!inner(
          project_id
        )
      `)
      .eq('site.project_id', projectId);

    if (error) {
      throw new Error(`Failed to fetch predictions: ${error.message}`);
    }

    return data.map(pred => ({
      id: pred.id,
      mineralType: pred.predicted_mineral_type,
      confidence: pred.confidence_score,
      estimatedQuantity: pred.predicted_quantity,
      estimatedValue: pred.predicted_value,
      coordinates: pred.prediction_data.coordinates,
      depth: pred.prediction_data.depth,
      quality: pred.prediction_data.quality,
      uncertainty: pred.prediction_data.uncertainty,
      geologicalContext: pred.prediction_data.geological_context,
      analysisMetadata: pred.prediction_data.metadata
    }));
  }

  private determineQuality(confidence: number, value: number): 'low' | 'medium' | 'high' | 'premium' {
    if (confidence >= 0.9 && value >= 1000000) return 'premium';
    if (confidence >= 0.8 && value >= 500000) return 'high';
    if (confidence >= 0.6 && value >= 100000) return 'medium';
    return 'low';
  }

  private getConfidenceRange(confidence: number): string {
    if (confidence >= 0.9) return 'Very High (90%+)';
    if (confidence >= 0.8) return 'High (80-90%)';
    if (confidence >= 0.6) return 'Medium (60-80%)';
    if (confidence >= 0.4) return 'Low (40-60%)';
    return 'Very Low (<40%)';
  }

  private calculateDistance(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private calculateDrillingPriority(prediction: MineralPrediction): number {
    // Weighted scoring: confidence (40%), value (30%), quality (20%), risk (10%)
    const confidenceScore = prediction.confidence * 0.4;
    const valueScore = Math.min(prediction.estimatedValue / 1000000, 1) * 0.3;
    const qualityScore = ({ low: 0.2, medium: 0.5, high: 0.8, premium: 1.0 }[prediction.quality]) * 0.2;
    const riskScore = (1 - prediction.uncertainty.riskFactors.length / 10) * 0.1;
    
    return confidenceScore + valueScore + qualityScore + riskScore;
  }

  private estimateDrillingCost(prediction: MineralPrediction): number {
    const baseCost = 50000; // Base drilling cost
    const depthMultiplier = (prediction.depth || 100) / 100;
    const accessibilityMultiplier = 1.2; // Assume moderate accessibility
    
    return baseCost * depthMultiplier * accessibilityMultiplier;
  }

  private generateDrillingReasoning(prediction: MineralPrediction): string {
    const reasons = [];
    
    if (prediction.confidence >= 0.8) {
      reasons.push('High confidence prediction');
    }
    
    if (prediction.estimatedValue >= 500000) {
      reasons.push('High estimated value');
    }
    
    if (prediction.quality === 'premium' || prediction.quality === 'high') {
      reasons.push('Premium quality mineral deposit');
    }
    
    if (prediction.uncertainty.riskFactors.length <= 2) {
      reasons.push('Low risk factors');
    }
    
    return reasons.join(', ') || 'Standard exploration target';
  }

  private analyzeTrends(predictions: MineralPrediction[]): {
    mostPromising: string[];
    riskAreas: string[];
    recommendations: string[];
  } {
    // Analyze mineral types by value and confidence
    const mineralStats = predictions.reduce((acc, pred) => {
      if (!acc[pred.mineralType]) {
        acc[pred.mineralType] = { totalValue: 0, avgConfidence: 0, count: 0 };
      }
      acc[pred.mineralType].totalValue += pred.estimatedValue;
      acc[pred.mineralType].avgConfidence += pred.confidence;
      acc[pred.mineralType].count++;
      return acc;
    }, {} as Record<string, { totalValue: number; avgConfidence: number; count: number }>);

    // Calculate averages
    Object.keys(mineralStats).forEach(mineral => {
      mineralStats[mineral].avgConfidence /= mineralStats[mineral].count;
    });

    // Find most promising minerals
    const mostPromising = Object.entries(mineralStats)
      .filter(([_, stats]) => stats.avgConfidence >= 0.7 && stats.totalValue >= 100000)
      .sort(([_, a], [__, b]) => b.totalValue - a.totalValue)
      .slice(0, 3)
      .map(([mineral]) => mineral);

    // Find risk areas (low confidence, high uncertainty)
    const riskAreas = predictions
      .filter(pred => pred.confidence < 0.6 || pred.uncertainty.riskFactors.length > 3)
      .map(pred => `${pred.mineralType} at ${pred.coordinates.lat.toFixed(4)}, ${pred.coordinates.lng.toFixed(4)}`)
      .slice(0, 5);

    // Generate recommendations
    const recommendations = [];
    if (mostPromising.length > 0) {
      recommendations.push(`Focus exploration on ${mostPromising.join(', ')} deposits`);
    }
    if (riskAreas.length > 0) {
      recommendations.push('Conduct additional surveys in high-risk areas');
    }
    recommendations.push('Consider environmental impact assessments for high-value sites');

    return { mostPromising, riskAreas, recommendations };
  }

  private async generateReportContent(project: any, predictions: MineralPrediction[], options: any): Promise<any> {
    // This would typically call an AI service to generate natural language content
    // For now, we'll create a structured template
    
    const totalValue = predictions.reduce((sum, pred) => sum + pred.estimatedValue, 0);
    const avgConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;
    
    return {
      summary: `Analysis of ${project.name} reveals ${predictions.length} potential mineral deposits with a total estimated value of $${totalValue.toLocaleString()}. Average confidence level is ${(avgConfidence * 100).toFixed(1)}%.`,
      sections: {
        executive: `The geological analysis of ${project.name} has identified significant mineral potential across ${predictions.length} locations. Key findings include high-confidence predictions for ${predictions.filter(p => p.confidence >= 0.8).length} sites with premium quality deposits.`,
        methodology: 'Analysis conducted using enhanced AI models incorporating geological, geophysical, and geochemical data with uncertainty quantification.',
        findings: `Identified ${Object.keys(predictions.reduce((acc, p) => ({ ...acc, [p.mineralType]: true }), {})).length} distinct mineral types with varying confidence levels and economic potential.`,
        recommendations: 'Prioritize drilling at high-confidence, high-value locations while conducting additional surveys in areas with elevated uncertainty.',
        appendices: ['Detailed prediction data', 'Uncertainty analysis', 'Risk assessment']
      }
    };
  }

  private async generateReportCharts(predictions: MineralPrediction[]): Promise<any[]> {
    // Generate chart configurations for the report
    return [
      {
        type: 'distribution',
        data: predictions.reduce((acc, pred) => {
          acc[pred.mineralType] = (acc[pred.mineralType] || 0) + pred.estimatedQuantity;
          return acc;
        }, {} as Record<string, number>),
        config: { title: 'Mineral Distribution by Type' }
      },
      {
        type: 'confidence',
        data: predictions.map(pred => ({ x: pred.confidence, y: pred.estimatedValue })),
        config: { title: 'Confidence vs. Estimated Value' }
      }
    ];
  }

  private calculateDataQuality(project: any): number {
    // Calculate data quality score based on available data
    let score = 0.5; // Base score
    
    if (project.sites?.length > 0) score += 0.2;
    if (project.sites?.some((s: any) => s.mineral_deposits?.length > 0)) score += 0.2;
    if (project.sites?.some((s: any) => s.ai_predictions?.length > 0)) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculateOverallConfidence(predictions: MineralPrediction[]): number {
    if (predictions.length === 0) return 0;
    return predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;
  }

  private async storeReport(report: GeologicalReport): Promise<void> {
    const { error } = await supabase
      .from('geological_reports')
      .insert({
        id: report.id,
        project_id: report.projectId,
        title: report.title,
        summary: report.summary,
        sections: report.sections,
        charts: report.charts,
        metadata: report.metadata,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to store report:', error);
    }
  }
}

// Export singleton instance
export const enhancedAI = new EnhancedAIAnalysis();