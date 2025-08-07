import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export interface AIAnalysisResult {
  mineral_type: string;
  confidence_score: number;
  expected_yield: string;
  risk_level: string;
  recommendation: string;
  target_depth?: string;
  estimated_resources?: string;
  development_timeline?: string;
}

export const useAIAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const runAnalysis = async (siteId: string, modelId: string): Promise<AIAnalysisResult | null> => {
    try {
      setIsAnalyzing(true);

      // Get site data for analysis
      const { data: site, error: siteError } = await supabase
        .from('exploration_sites')
        .select('*, mineral_deposits(*)')
        .eq('id', siteId)
        .single();

      if (siteError) throw siteError;

      // Get model data
      const { data: model, error: modelError } = await supabase
        .from('ai_models')
        .select('*')
        .eq('id', modelId)
        .single();

      if (modelError) throw modelError;

      // Simulate AI analysis with realistic geological assessment
      const analysisResult = simulateAIAnalysis(site, model);

      // Save prediction to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: prediction, error: predictionError } = await supabase
        .from('predictions')
        .insert({
          model_id: modelId,
          site_id: siteId,
          prediction_data: analysisResult as any,
          confidence_score: analysisResult.confidence_score,
          status: 'completed' as const,
          created_by: user.id
        })
        .select()
        .single();

      if (predictionError) throw predictionError;

      toast({
        title: "Analysis Complete",
        description: `AI analysis completed with ${analysisResult.confidence_score}% confidence`,
      });

      return analysisResult;
    } catch (error) {
      console.error('Error running AI analysis:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to complete AI analysis",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const simulateAIAnalysis = (site: any, model: any): AIAnalysisResult => {
    // Extract site characteristics
    const elevation = site.elevation || 1000;
    const siteType = site.site_type;
    const existingDeposits = site.mineral_deposits || [];
    
    // Model-specific analysis logic
    const modelType = model.model_type;
    const modelAccuracy = model.performance_metrics?.accuracy || 85;
    
    // Determine mineral type based on geological context and existing deposits
    let mineral_type = 'Unknown';
    let base_confidence = Math.random() * 20 + 60; // 60-80% base
    
    if (existingDeposits.length > 0) {
      mineral_type = existingDeposits[0].mineral_type;
      base_confidence += 15; // Boost confidence if deposits already found
    } else {
      // Predict based on elevation and geological context
      if (elevation > 3000) {
        mineral_type = Math.random() > 0.5 ? 'Copper' : 'Lithium';
      } else if (elevation > 1500) {
        mineral_type = Math.random() > 0.6 ? 'Gold' : 'Silver';
      } else {
        mineral_type = Math.random() > 0.7 ? 'Iron' : 'Nickel';
      }
    }

    // Adjust confidence based on model accuracy
    const confidence_score = Math.min(95, base_confidence + (modelAccuracy - 85) * 0.5);

    // Determine expected yield
    let expected_yield = 'Medium';
    if (confidence_score > 90) expected_yield = 'Very High';
    else if (confidence_score > 80) expected_yield = 'High';
    else if (confidence_score < 65) expected_yield = 'Low';

    // Determine risk level
    let risk_level = 'Medium';
    if (siteType === 'drilling' && confidence_score > 85) risk_level = 'Low';
    else if (elevation > 3500 || confidence_score < 70) risk_level = 'High';

    // Generate recommendation
    let recommendation = 'Continue exploration with standard protocols';
    if (confidence_score > 90) {
      recommendation = 'Fast-track to feasibility study';
    } else if (confidence_score > 80) {
      recommendation = 'Proceed with detailed drilling program';
    } else if (confidence_score < 65) {
      recommendation = 'Additional geophysical surveys needed';
    }

    // Generate additional insights
    const target_depth = `${50 + Math.floor(Math.random() * 300)}-${200 + Math.floor(Math.random() * 600)}m`;
    const estimated_resources = generateResourceEstimate(mineral_type, confidence_score);
    const development_timeline = `${12 + Math.floor(Math.random() * 24)} months`;

    return {
      mineral_type,
      confidence_score: Math.round(confidence_score * 10) / 10,
      expected_yield,
      risk_level,
      recommendation,
      target_depth,
      estimated_resources,
      development_timeline
    };
  };

  const generateResourceEstimate = (mineral: string, confidence: number): string => {
    const multiplier = confidence / 100;
    
    switch (mineral) {
      case 'Gold':
        return `${(1.5 + Math.random() * 3) * multiplier}M oz`;
      case 'Silver':
        return `${(50 + Math.random() * 150) * multiplier}M oz`;
      case 'Copper':
        return `${(5 + Math.random() * 20) * multiplier}M tonnes`;
      case 'Lithium':
        return `${(20 + Math.random() * 80) * multiplier}M tonnes LCE`;
      case 'Iron':
        return `${(100 + Math.random() * 500) * multiplier}M tonnes`;
      case 'Nickel':
        return `${(0.5 + Math.random() * 2) * multiplier}M tonnes`;
      default:
        return `${(10 + Math.random() * 50) * multiplier}M tonnes`;
    }
  };

  return {
    runAnalysis,
    isAnalyzing
  };
};