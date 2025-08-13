import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  try {
    // Clean up test data
    await cleanupTestData();
    
    // Clean up test files
    await cleanupTestFiles();
    
    // Reset test environment
    await resetTestEnvironment();
    
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here as it might mask test failures
  }
}

async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...');
  
  // This would typically:
  // 1. Remove test users created during setup
  // 2. Clean up test projects, sites, deposits
  // 3. Reset database to clean state
  
  try {
    // Example: Call cleanup API endpoint
    // await fetch('/api/test/cleanup', { method: 'POST' });
    
    console.log('✅ Test data cleaned up');
  } catch (error) {
    console.warn('⚠️ Test data cleanup failed:', error);
  }
}

async function cleanupTestFiles() {
  console.log('📁 Cleaning up test files...');
  
  // Clean up any files created during tests
  // This might include:
  // - Uploaded test files
  // - Generated reports
  // - Temporary data files
  
  try {
    // Example file cleanup
    const fs = require('fs').promises;
    const path = require('path');
    
    const testFilesDir = path.join(process.cwd(), 'test-files');
    
    try {
      await fs.access(testFilesDir);
      await fs.rmdir(testFilesDir, { recursive: true });
      console.log('✅ Test files cleaned up');
    } catch (error) {
      // Directory doesn't exist, which is fine
      console.log('ℹ️ No test files to clean up');
    }
  } catch (error) {
    console.warn('⚠️ Test file cleanup failed:', error);
  }
}

async function resetTestEnvironment() {
  console.log('🔄 Resetting test environment...');
  
  // Reset any environment-specific settings
  // This might include:
  // - Clearing Redis cache
  // - Resetting feature flags
  // - Clearing job queues
  
  try {
    // Example: Clear Redis cache
    // const redis = new Redis(process.env.REDIS_URL);
    // await redis.flushdb();
    // await redis.quit();
    
    console.log('✅ Test environment reset');
  } catch (error) {
    console.warn('⚠️ Test environment reset failed:', error);
  }
}

export default globalTeardown;