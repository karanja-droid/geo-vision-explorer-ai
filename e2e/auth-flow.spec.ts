import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    // Should redirect to auth page or show auth form
    await expect(page.locator('[data-testid="auth-form"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should show validation errors for short password', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Password must be at least 6 characters')).toBeVisible();
  });

  test('should successfully sign up new user', async ({ page }) => {
    // Click on sign up tab/link
    await page.click('text=Sign Up');

    // Fill sign up form
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    await page.fill('input[name="fullName"]', 'Test User');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show success message or redirect
    await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 10000 });
  });

  test('should successfully sign in existing user', async ({ page }) => {
    // Use test credentials (you'll need to set up a test user)
    await page.fill('input[type="email"]', 'test@geovision.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
  });

  test('should handle OAuth sign in with Google', async ({ page }) => {
    // Click Google OAuth button
    await page.click('[data-testid="google-oauth-button"]');

    // Note: In a real test, you'd need to handle the OAuth flow
    // For now, we'll just check that the OAuth URL is correct
    await page.waitForURL(/accounts\.google\.com/);
    expect(page.url()).toContain('accounts.google.com');
  });

  test('should handle OAuth sign in with GitHub', async ({ page }) => {
    // Click GitHub OAuth button
    await page.click('[data-testid="github-oauth-button"]');

    // Check that GitHub OAuth URL is correct
    await page.waitForURL(/github\.com/);
    expect(page.url()).toContain('github.com');
  });

  test('should show forgot password form', async ({ page }) => {
    await page.click('text=Forgot password?');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Reset Password');
  });

  test('should handle password reset request', async ({ page }) => {
    await page.click('text=Forgot password?');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Password reset email sent')).toBeVisible();
  });

  test('should toggle between sign in and sign up modes', async ({ page }) => {
    // Should start in sign in mode
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');

    // Switch to sign up
    await page.click('text=Sign Up');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign Up');
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toBeVisible();

    // Switch back to sign in
    await page.click('text=Sign In');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
    await expect(page.locator('input[name="confirmPassword"]')).not.toBeVisible();
  });

  test('should show loading state during authentication', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // Click submit and immediately check for loading state
    await page.click('button[type="submit"]');
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
    await expect(page.locator('text=Signing in...')).toBeVisible();
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
    
    // Form should be re-enabled
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('should persist authentication state on page refresh', async ({ page }) => {
    // Sign in first
    await page.fill('input[type="email"]', 'test@geovision.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');

    // Refresh the page
    await page.reload();

    // Should still be authenticated and on dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="dashboard-header"]')).toBeVisible();
  });

  test('should sign out successfully', async ({ page }) => {
    // Sign in first
    await page.fill('input[type="email"]', 'test@geovision.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');

    // Click user menu and sign out
    await page.click('[data-testid="user-menu-trigger"]');
    await page.click('text=Log out');

    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');
    await expect(page.locator('[data-testid="auth-form"]')).toBeVisible();
  });

  test('should handle session expiration', async ({ page }) => {
    // Sign in first
    await page.fill('input[type="email"]', 'test@geovision.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');

    // Simulate session expiration by clearing localStorage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to a protected route
    await page.goto('/projects');

    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('should show appropriate role-based content after login', async ({ page }) => {
    // Sign in as administrator
    await page.fill('input[type="email"]', 'admin@geovision.com');
    await page.fill('input[type="password"]', 'adminpassword123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');

    // Should see admin-specific navigation items
    await expect(page.locator('text=User Management')).toBeVisible();
    await expect(page.locator('text=System Settings')).toBeVisible();
  });

  test('should handle MFA setup flow', async ({ page }) => {
    // Sign in with user that needs MFA setup
    await page.fill('input[type="email"]', 'mfa-user@geovision.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should be redirected to MFA setup
    await expect(page).toHaveURL('/auth/mfa-setup');
    await expect(page.locator('text=Set up two-factor authentication')).toBeVisible();
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
  });

  test('should handle MFA verification', async ({ page }) => {
    // Sign in with user that has MFA enabled
    await page.fill('input[type="email"]', 'mfa-enabled@geovision.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Should be redirected to MFA verification
    await expect(page).toHaveURL('/auth/mfa-verify');
    await expect(page.locator('text=Enter verification code')).toBeVisible();
    await expect(page.locator('input[name="mfaCode"]')).toBeVisible();

    // Enter MFA code (in real test, you'd use a test TOTP code)
    await page.fill('input[name="mfaCode"]', '123456');
    await page.click('button[type="submit"]');

    // Should proceed to dashboard (or show error for invalid code)
    // This depends on whether the test code is valid
  });
});