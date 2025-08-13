import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@geovision.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should display projects list', async ({ page }) => {
    await page.goto('/projects');
    
    // Should show projects page
    await expect(page.locator('h1')).toContainText('Projects');
    await expect(page.locator('[data-testid="projects-table"]')).toBeVisible();
    
    // Should show sample projects
    await expect(page.locator('text=Nevada Gold Fields Exploration')).toBeVisible();
    await expect(page.locator('text=Colorado Silver Mountain Survey')).toBeVisible();
  });

  test('should create new project successfully', async ({ page }) => {
    await page.goto('/projects');
    
    // Click create project button
    await page.click('[data-testid="create-project-button"]');
    
    // Should open project form
    await expect(page.locator('text=Create New Project')).toBeVisible();
    
    // Fill project form
    const projectName = `Test Project ${Date.now()}`;
    await page.fill('input[name="name"]', projectName);
    await page.fill('input[name="location"]', 'Test Location, Nevada');
    await page.fill('textarea[name="description"]', 'Test project description for E2E testing');
    await page.fill('input[name="budget"]', '5000000');
    await page.fill('input[name="coordinates.latitude"]', '40.5');
    await page.fill('input[name="coordinates.longitude"]', '-116.5');
    
    // Set dates
    await page.fill('input[name="start_date"]', '2024-01-01');
    await page.fill('input[name="end_date"]', '2024-12-31');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message and redirect
    await expect(page.locator('text=Project created successfully')).toBeVisible();
    await expect(page.locator(`text=${projectName}`)).toBeVisible();
  });

  test('should validate project form fields', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="create-project-button"]');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=Project name is required')).toBeVisible();
    await expect(page.locator('text=Location is required')).toBeVisible();
  });

  test('should validate coordinate ranges', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="create-project-button"]');
    
    // Fill required fields
    await page.fill('input[name="name"]', 'Test Project');
    await page.fill('input[name="location"]', 'Test Location');
    
    // Enter invalid coordinates
    await page.fill('input[name="coordinates.latitude"]', '95'); // Invalid > 90
    await page.fill('input[name="coordinates.longitude"]', '200'); // Invalid > 180
    
    await page.click('button[type="submit"]');
    
    // Should show coordinate validation errors
    await expect(page.locator('text=Invalid latitude')).toBeVisible();
    await expect(page.locator('text=Invalid longitude')).toBeVisible();
  });

  test('should edit existing project', async ({ page }) => {
    await page.goto('/projects');
    
    // Click edit button on first project
    await page.click('[data-testid="edit-project-button"]:first-child');
    
    // Should open edit form with existing data
    await expect(page.locator('text=Edit Project')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue('Nevada Gold Fields Exploration');
    
    // Update project name
    const updatedName = `Updated Project ${Date.now()}`;
    await page.fill('input[name="name"]', updatedName);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text=Project updated successfully')).toBeVisible();
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
  });

  test('should view project details', async ({ page }) => {
    await page.goto('/projects');
    
    // Click on project name to view details
    await page.click('text=Nevada Gold Fields Exploration');
    
    // Should navigate to project detail page
    await expect(page.locator('h1')).toContainText('Nevada Gold Fields Exploration');
    await expect(page.locator('text=Elko County, Nevada')).toBeVisible();
    
    // Should show project metrics
    await expect(page.locator('[data-testid="project-metrics"]')).toBeVisible();
    await expect(page.locator('text=Total Sites')).toBeVisible();
    await expect(page.locator('text=Mineral Deposits')).toBeVisible();
  });

  test('should display project sites', async ({ page }) => {
    await page.goto('/projects');
    await page.click('text=Nevada Gold Fields Exploration');
    
    // Should show sites tab
    await page.click('text=Sites');
    await expect(page.locator('[data-testid="sites-table"]')).toBeVisible();
    
    // Should show sample sites
    await expect(page.locator('text=Carlin North Outcrop')).toBeVisible();
    await expect(page.locator('text=Carlin Drill Site Alpha')).toBeVisible();
  });

  test('should create new site within project', async ({ page }) => {
    await page.goto('/projects');
    await page.click('text=Nevada Gold Fields Exploration');
    await page.click('text=Sites');
    
    // Click create site button
    await page.click('[data-testid="create-site-button"]');
    
    // Fill site form
    const siteName = `Test Site ${Date.now()}`;
    await page.fill('input[name="name"]', siteName);
    await page.selectOption('select[name="site_type"]', 'outcrop');
    await page.fill('textarea[name="description"]', 'Test site description');
    await page.fill('input[name="coordinates.latitude"]', '40.52');
    await page.fill('input[name="coordinates.longitude"]', '-116.48');
    await page.fill('input[name="elevation"]', '1850');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text=Exploration site created successfully')).toBeVisible();
    await expect(page.locator(`text=${siteName}`)).toBeVisible();
  });

  test('should filter projects by status', async ({ page }) => {
    await page.goto('/projects');
    
    // Use filter dropdown
    await page.click('[data-testid="status-filter"]');
    await page.click('text=Active');
    
    // Should show only active projects
    await expect(page.locator('text=Nevada Gold Fields Exploration')).toBeVisible();
    await expect(page.locator('text=Colorado Silver Mountain Survey')).toBeVisible();
    
    // Completed projects should be hidden
    await expect(page.locator('text=Utah Rare Earth Elements Study')).not.toBeVisible();
  });

  test('should search projects by name', async ({ page }) => {
    await page.goto('/projects');
    
    // Use search input
    await page.fill('[data-testid="project-search"]', 'gold');
    
    // Should show only projects matching search
    await expect(page.locator('text=Nevada Gold Fields Exploration')).toBeVisible();
    await expect(page.locator('text=Colorado Silver Mountain Survey')).not.toBeVisible();
  });

  test('should sort projects by different columns', async ({ page }) => {
    await page.goto('/projects');
    
    // Click on name column header to sort
    await page.click('[data-testid="sort-name"]');
    
    // Should sort projects alphabetically
    const projectNames = await page.locator('[data-testid="project-name"]').allTextContents();
    const sortedNames = [...projectNames].sort();
    expect(projectNames).toEqual(sortedNames);
    
    // Click again to reverse sort
    await page.click('[data-testid="sort-name"]');
    const reversedNames = await page.locator('[data-testid="project-name"]').allTextContents();
    expect(reversedNames).toEqual(sortedNames.reverse());
  });

  test('should paginate through projects', async ({ page }) => {
    await page.goto('/projects');
    
    // Should show pagination controls
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    
    // Check current page
    await expect(page.locator('text=Page 1 of')).toBeVisible();
    
    // If there are multiple pages, test navigation
    const nextButton = page.locator('[data-testid="next-page"]');
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await expect(page.locator('text=Page 2 of')).toBeVisible();
      
      // Go back to first page
      await page.click('[data-testid="prev-page"]');
      await expect(page.locator('text=Page 1 of')).toBeVisible();
    }
  });

  test('should delete project with confirmation', async ({ page }) => {
    await page.goto('/projects');
    
    // Click delete button on a test project
    await page.click('[data-testid="delete-project-button"]:first-child');
    
    // Should show confirmation dialog
    await expect(page.locator('text=Are you sure you want to delete this project?')).toBeVisible();
    
    // Cancel deletion
    await page.click('text=Cancel');
    await expect(page.locator('text=Are you sure you want to delete this project?')).not.toBeVisible();
    
    // Try deletion again and confirm
    await page.click('[data-testid="delete-project-button"]:first-child');
    await page.click('text=Delete');
    
    // Should show success message
    await expect(page.locator('text=Project deleted successfully')).toBeVisible();
  });

  test('should display project metrics and charts', async ({ page }) => {
    await page.goto('/projects');
    await page.click('text=Nevada Gold Fields Exploration');
    
    // Should show metrics cards
    await expect(page.locator('[data-testid="total-sites-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-deposits-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-predictions-metric"]')).toBeVisible();
    
    // Should show charts
    await expect(page.locator('[data-testid="project-metrics-chart"]')).toBeVisible();
    
    // Test chart tabs
    await page.click('text=Minerals');
    await expect(page.locator('[data-testid="mineral-distribution-chart"]')).toBeVisible();
    
    await page.click('text=Confidence');
    await expect(page.locator('[data-testid="confidence-distribution-chart"]')).toBeVisible();
  });

  test('should handle project form cancellation', async ({ page }) => {
    await page.goto('/projects');
    await page.click('[data-testid="create-project-button"]');
    
    // Fill some data
    await page.fill('input[name="name"]', 'Test Project');
    
    // Cancel form
    await page.click('text=Cancel');
    
    // Should return to projects list without creating project
    await expect(page.locator('h1')).toContainText('Projects');
    await expect(page.locator('text=Test Project')).not.toBeVisible();
  });

  test('should show loading states during operations', async ({ page }) => {
    await page.goto('/projects');
    
    // Should show loading state when creating project
    await page.click('[data-testid="create-project-button"]');
    await page.fill('input[name="name"]', 'Loading Test Project');
    await page.fill('input[name="location"]', 'Test Location');
    
    await page.click('button[type="submit"]');
    
    // Should show loading state
    await expect(page.locator('text=Creating...')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    
    await page.goto('/projects');
    
    // Should show error message
    await expect(page.locator('text=Failed to load projects')).toBeVisible();
    
    // Should show retry button
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});