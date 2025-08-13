#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { sampleDataGenerator } from '../src/utils/sampleDataGenerator';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedDatabase() {
  console.log('🌱 Starting database seeding process...\n');

  try {
    // Generate sample data
    console.log('📊 Generating sample data...');
    const data = sampleDataGenerator.generateCompleteDataset();
    
    console.log(`✅ Generated:
    - ${data.profiles.length} user profiles
    - ${data.projects.length} projects
    - ${data.sites.length} exploration sites
    - ${data.deposits.length} mineral deposits
    - ${data.predictions.length} AI predictions
    - Total: ${data.profiles.length + data.projects.length + data.sites.length + data.deposits.length + data.predictions.length} records\n`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    await clearExistingData();

    // Insert profiles
    console.log('👥 Inserting user profiles...');
    const { error: profilesError } = await supabase
      .from('profiles')
      .insert(data.profiles.map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        department: profile.department,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
        skills: profile.skills,
        certifications: profile.certifications,
        experience_years: profile.experience_years,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      })));

    if (profilesError) {
      console.error('❌ Error inserting profiles:', profilesError);
    } else {
      console.log(`✅ Inserted ${data.profiles.length} profiles`);
    }

    // Insert projects
    console.log('📁 Inserting projects...');
    const { error: projectsError } = await supabase
      .from('projects')
      .insert(data.projects.map(project => ({
        id: project.id,
        name: project.name,
        description: project.description,
        location: project.location,
        status: project.status,
        budget: project.budget,
        start_date: project.start_date,
        end_date: project.end_date,
        coordinates: project.coordinates,
        created_at: project.created_at,
        updated_at: project.updated_at,
        user_id: project.user_id,
      })));

    if (projectsError) {
      console.error('❌ Error inserting projects:', projectsError);
    } else {
      console.log(`✅ Inserted ${data.projects.length} projects`);
    }

    // Insert sites
    console.log('🏔️ Inserting exploration sites...');
    const { error: sitesError } = await supabase
      .from('exploration_sites')
      .insert(data.sites.map(site => ({
        id: site.id,
        project_id: site.project_id,
        name: site.name,
        description: site.description,
        coordinates: site.coordinates,
        elevation: site.elevation,
        site_type: site.site_type,
        access_notes: site.access_notes,
        created_at: site.created_at,
        updated_at: site.updated_at,
      })));

    if (sitesError) {
      console.error('❌ Error inserting sites:', sitesError);
    } else {
      console.log(`✅ Inserted ${data.sites.length} exploration sites`);
    }

    // Insert mineral deposits
    console.log('💎 Inserting mineral deposits...');
    const { error: depositsError } = await supabase
      .from('mineral_deposits')
      .insert(data.deposits.map(deposit => ({
        id: deposit.id,
        site_id: deposit.site_id,
        mineral_type: deposit.mineral_type,
        grade: deposit.grade,
        tonnage: deposit.tonnage,
        confidence_level: deposit.confidence_level,
        discovery_date: deposit.discovery_date,
        coordinates: deposit.coordinates,
        depth: deposit.depth,
        notes: deposit.notes,
        created_at: deposit.created_at,
        updated_at: deposit.updated_at,
      })));

    if (depositsError) {
      console.error('❌ Error inserting deposits:', depositsError);
    } else {
      console.log(`✅ Inserted ${data.deposits.length} mineral deposits`);
    }

    // Insert predictions
    console.log('🤖 Inserting AI predictions...');
    const { error: predictionsError } = await supabase
      .from('predictions')
      .insert(data.predictions.map(prediction => ({
        id: prediction.id,
        deposit_id: prediction.deposit_id,
        model_name: prediction.model_name,
        confidence_score: prediction.confidence_score,
        predicted_grade: prediction.predicted_grade,
        predicted_tonnage: prediction.predicted_tonnage,
        status: prediction.status,
        metadata: prediction.metadata,
        features_used: prediction.features_used,
        created_at: prediction.created_at,
        updated_at: prediction.updated_at,
      })));

    if (predictionsError) {
      console.error('❌ Error inserting predictions:', predictionsError);
    } else {
      console.log(`✅ Inserted ${data.predictions.length} AI predictions`);
    }

    // Verify data insertion
    console.log('\n🔍 Verifying data insertion...');
    await verifyDataInsertion();

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   - Total records inserted: ${data.profiles.length + data.projects.length + data.sites.length + data.deposits.length + data.predictions.length}`);
    console.log(`   - Profiles: ${data.profiles.length}`);
    console.log(`   - Projects: ${data.projects.length}`);
    console.log(`   - Sites: ${data.sites.length}`);
    console.log(`   - Deposits: ${data.deposits.length}`);
    console.log(`   - Predictions: ${data.predictions.length}`);

  } catch (error) {
    console.error('❌ Error during database seeding:', error);
    process.exit(1);
  }
}

async function clearExistingData() {
  const tables = ['predictions', 'mineral_deposits', 'exploration_sites', 'projects', 'profiles'];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (error) {
      console.warn(`⚠️ Warning: Could not clear ${table}:`, error.message);
    } else {
      console.log(`🧹 Cleared ${table}`);
    }
  }
}

async function verifyDataInsertion() {
  const tables = ['profiles', 'projects', 'exploration_sites', 'mineral_deposits', 'predictions'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`❌ Error verifying ${table}:`, error);
    } else {
      console.log(`✅ ${table}: ${count} records`);
    }
  }
}

// Export SQL for manual insertion
async function exportSQL() {
  console.log('📄 Generating SQL export...');
  const sql = sampleDataGenerator.exportToSQL();
  
  const fs = await import('fs');
  const path = await import('path');
  
  const sqlPath = path.join(process.cwd(), 'sample-data.sql');
  fs.writeFileSync(sqlPath, sql);
  
  console.log(`✅ SQL export saved to: ${sqlPath}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--sql-only')) {
    await exportSQL();
  } else if (args.includes('--help')) {
    console.log(`
🌱 GeoVision AI Miner Database Seeder

Usage:
  npm run seed              # Seed the database with sample data
  npm run seed -- --sql-only   # Generate SQL file only
  npm run seed -- --help       # Show this help

Environment Variables Required:
  VITE_SUPABASE_URL         # Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY # Your Supabase service role key

Options:
  --sql-only    Generate SQL file instead of direct database insertion
  --help        Show this help message
    `);
  } else {
    await seedDatabase();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { seedDatabase, exportSQL };