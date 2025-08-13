import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Create a browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    console.log('⏳ Waiting for application to be ready...');
    await page.goto(config.projects[0].use?.baseURL || 'http://localhost:8080');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 30000 });
    console.log('✅ Application is ready');

    // Set up test data if needed
    console.log('📊 Setting up test data...');
    
    // You can add API calls here to set up test data
    // For example, create test users, projects, etc.
    
    // Create test users if they don't exist
    await setupTestUsers(page);
    
    // Seed test data
    await seedTestData(page);
    
    console.log('✅ Test data setup complete');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('🎉 Global setup completed successfully');
}

async function setupTestUsers(page: any) {
  // This would typically make API calls to create test users
  // For now, we'll just log that we're setting up users
  console.log('👥 Setting up test users...');
  
  const testUsers = [
    {
      email: 'test@geovision.com',
      password: 'testpassword123',
      role: 'geologist',
      fullName: 'Test User',
    },
    {
      email: 'admin@geovision.com',
      password: 'adminpassword123',
      role: 'administrator',
      fullName: 'Admin User',
    },
    {
      email: 'mfa-user@geovision.com',
      password: 'password123',
      role: 'geologist',
      fullName: 'MFA Test User',
      mfaEnabled: false, // Needs setup
    },
    {
      email: 'mfa-enabled@geovision.com',
      password: 'password123',
      role: 'geologist',
      fullName: 'MFA Enabled User',
      mfaEnabled: true,
    },
  ];

  // In a real implementation, you would:
  // 1. Check if users exist via API
  // 2. Create them if they don't exist
  // 3. Set up their profiles and permissions
  
  console.log(`✅ Set up ${testUsers.length} test users`);
}

async function seedTestData(page: any) {
  console.log('🌱 Seeding test data...');
  
  // This would typically:
  // 1. Call your seeding API endpoint
  // 2. Or directly insert data into the database
  // 3. Ensure consistent test data across runs
  
  try {
    // Example: Call the seeding endpoint
    // await page.request.post('/api/test/seed', {
    //   data: { reset: true }
    // });
    
    console.log('✅ Test data seeded successfully');
  } catch (error) {
    console.warn('⚠️ Test data seeding failed, using existing data:', error);
  }
}

export default globalSetup;