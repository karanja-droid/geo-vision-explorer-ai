import { supabase } from '@/integrations/supabase/client';

export const createSampleData = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated to create sample data');
    }

    console.log('Creating sample data for user:', user.id);

    // Create sample AI models
    const aiModels = [
      {
        name: 'GeoSight Mineral Classifier',
        version: '2.1',
        model_type: 'neural_network',
        training_data_info: {
          training_samples: 50000,
          geological_regions: ['Nevada', 'Chile', 'Australia'],
          mineral_types: ['gold', 'copper', 'lithium'],
          data_sources: ['satellite', 'geochemical', 'magnetic']
        },
        performance_metrics: {
          accuracy: 92.5,
          precision: 90.2,
          recall: 94.1,
          f1_score: 92.1,
          last_validated: '2024-01-15'
        },
        is_active: true,
        created_by: user.id
      },
      {
        name: 'LithiumFinder AI',
        version: '3.0',
        model_type: 'random_forest',
        training_data_info: {
          training_samples: 30000,
          geological_formations: ['brine', 'pegmatite', 'sedimentary'],
          mineral_types: ['lithium'],
          data_sources: ['geochemical', 'satellite', 'drilling']
        },
        performance_metrics: {
          accuracy: 95.2,
          precision: 93.8,
          recall: 96.5,
          f1_score: 95.1,
          last_validated: '2024-01-20'
        },
        is_active: true,
        created_by: user.id
      }
    ];

    const { data: createdModels, error: modelsError } = await supabase
      .from('ai_models')
      .insert(aiModels)
      .select();

    if (modelsError) {
      console.error('Error creating AI models:', modelsError);
      throw modelsError;
    }

    console.log('Created AI models:', createdModels);

    // Create sample projects
    const projects = [
      {
        name: 'Nevada Gold Rush Revival',
        description: 'Large-scale gold exploration in Nevada\'s Carlin Trend using advanced AI prediction models',
        country: 'USA',
        province: 'Nevada',
        geology_type: 'Sediment-hosted gold',
        target_minerals: ['Gold'],
        status: 'active' as const,
        budget: 15000000,
        start_date: '2024-01-01',
        end_date: '2025-12-31',
        owner_id: user.id
      },
      {
        name: 'Chilean Copper Expansion',
        description: 'Expansion of copper mining operations in the Atacama Desert with lithium co-production potential',
        country: 'Chile',
        province: 'Atacama',
        geology_type: 'Porphyry copper',
        target_minerals: ['Copper', 'Lithium'],
        status: 'active' as const,
        budget: 25000000,
        start_date: '2023-06-01',
        end_date: '2026-05-31',
        owner_id: user.id
      }
    ];

    const { data: createdProjects, error: projectsError } = await supabase
      .from('projects')
      .insert(projects)
      .select();

    if (projectsError) {
      console.error('Error creating projects:', projectsError);
      throw projectsError;
    }

    console.log('Created projects:', createdProjects);

    console.log('Sample data creation completed successfully!');

    return {
      models: createdModels,
      projects: createdProjects,
      sites: [],
      deposits: [],
      predictions: [],
      totalRecords: (createdModels?.length || 0) + (createdProjects?.length || 0)
    };

  } catch (error) {
    console.error('Error creating sample data:', error);
    throw error;
  }
};