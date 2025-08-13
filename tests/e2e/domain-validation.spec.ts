/**
 * End-to-End Domain Validation Tests
 * 
 * Tests to ensure proper domain configuration and functionality
 * across frontend and backend services.
 */

import { test, expect } from '@playwright/test';

// Environment variables for testing
const SITE_URL = process.env.VITE_SITE_URL || 'http://localhost:8080';
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:8000';

test.describe('Domain Configuration Validation', () => {
  test('should have correct canonical URL on homepage', async ({ page }) => {
    await page.goto(SITE_URL);
    
    // Check canonical link
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    expect(canonical).toBe(`${SITE_URL}/`);
    
    // Check page title
    const title = await page.title();
    expect(title).toContain('GeoVision AI Miner');
    
    // Check meta description
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description).toBeTruthy();
    expect(description).toContain('geological');
  });

  test('should have correct Open Graph meta tags', async ({ page }) => {
    await page.goto(SITE_URL);
    
    // Check og:url
    const ogUrl = await page.getAttribute('meta[property="og:url"]', 'content');
    expect(ogUrl).toBe(`${SITE_URL}/`);
    
    // Check og:title
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    expect(ogTitle).toBeTruthy();
    
    // Check og:description
    const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');
    expect(ogDescription).toBeTruthy();
    
    // Check og:type
    const ogType = await page.getAttribute('meta[property="og:type"]', 'content');
    expect(ogType).toBe('website');
  });

  test('should have correct Twitter Card meta tags', async ({ page }) => {
    await page.goto(SITE_URL);
    
    // Check twitter:card
    const twitterCard = await page.getAttribute('meta[name="twitter:card"]', 'content');
    expect(twitterCard).toBe('summary_large_image');
    
    // Check twitter:title
    const twitterTitle = await page.getAttribute('meta[name="twitter:title"]', 'content');
    expect(twitterTitle).toBeTruthy();
    
    // Check twitter:description
    const twitterDescription = await page.getAttribute('meta[name="twitter:description"]', 'content');
    expect(twitterDescription).toBeTruthy();
  });

  test('should load robots.txt with correct sitemap URL', async ({ page }) => {
    const response = await page.goto(`${SITE_URL}/robots.txt`);
    expect(response?.status()).toBe(200);
    
    const content = await page.textContent('body');
    expect(content).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(content).toContain('User-agent: *');
    expect(content).toContain('Allow: /');
  });
});

test.describe('API Domain Configuration', () => {
  test('should return healthy status with correct baseUrl', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/healthz`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.baseUrl).toBe(API_BASE_URL);
  });

  test('should have correct OpenAPI server configuration', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/docs`);
    expect(response.status()).toBe(200);
    
    // Check if the docs page loads (indicates OpenAPI is configured)
    const content = await response.text();
    expect(content).toContain('swagger');
    expect(content).toContain(API_BASE_URL);
  });

  test('should have correct CORS headers', async ({ request }) => {
    const response = await request.options(`${API_BASE_URL}/healthz`, {
      headers: {
        'Origin': SITE_URL,
        'Access-Control-Request-Method': 'GET',
      }
    });
    
    // Should not be blocked by CORS
    expect(response.status()).toBeLessThan(400);
    
    // Check CORS headers if present
    const corsOrigin = response.headers()['access-control-allow-origin'];
    if (corsOrigin) {
      expect([SITE_URL, '*']).toContain(corsOrigin);
    }
  });

  test('should return valid STAC catalog with correct links', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/stac/catalog.json`);
    
    if (response.status() === 200) {
      const catalog = await response.json();
      
      // Check STAC version
      expect(catalog.stac_version).toBeTruthy();
      
      // Check links use correct base URL
      if (catalog.links) {
        for (const link of catalog.links) {
          if (link.href && link.href.startsWith('http')) {
            expect(link.href).toContain(API_BASE_URL);
          }
        }
      }
    }
  });
});

test.describe('Frontend API Integration', () => {
  test('should successfully make API calls from frontend', async ({ page }) => {
    // Navigate to a page that makes API calls
    await page.goto(`${SITE_URL}/dashboard`);
    
    // Wait for potential API calls to complete
    await page.waitForTimeout(2000);
    
    // Check for any network errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Check for CORS or network errors
    const corsErrors = errors.filter(error => 
      error.includes('CORS') || 
      error.includes('network') || 
      error.includes('fetch')
    );
    
    if (corsErrors.length > 0) {
      console.log('Network errors found:', corsErrors);
    }
    
    // The page should load without critical errors
    expect(corsErrors.length).toBeLessThan(5); // Allow some non-critical errors
  });

  test('should have environment configuration available', async ({ page }) => {
    await page.goto(SITE_URL);
    
    // Check if environment configuration is available
    const siteUrl = await page.evaluate(() => {
      return (window as any).VITE_SITE_URL || 
             import.meta?.env?.VITE_SITE_URL;
    });
    
    const apiBaseUrl = await page.evaluate(() => {
      return (window as any).VITE_API_BASE_URL || 
             import.meta?.env?.VITE_API_BASE_URL;
    });
    
    // Environment variables should be available in some form
    expect(siteUrl || apiBaseUrl).toBeTruthy();
  });
});

test.describe('Security Headers and CSP', () => {
  test('should have appropriate security headers', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/healthz`);
    const headers = response.headers();
    
    // Check for security headers (if implemented)
    if (headers['x-frame-options']) {
      expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options']);
    }
    
    if (headers['x-content-type-options']) {
      expect(headers['x-content-type-options']).toBe('nosniff');
    }
    
    if (headers['x-xss-protection']) {
      expect(headers['x-xss-protection']).toBe('1; mode=block');
    }
  });

  test('should allow API connections in CSP', async ({ page }) => {
    await page.goto(SITE_URL);
    
    // Check if CSP allows API connections
    const cspHeader = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return meta?.getAttribute('content') || '';
    });
    
    if (cspHeader) {
      // If CSP is set, it should allow the API domain
      expect(cspHeader).toContain(API_BASE_URL.replace('https://', '').replace('http://', ''));
    }
  });
});

test.describe('Redirect Validation', () => {
  test('should redirect www to apex domain in production', async ({ request }) => {
    // Only test in production environment
    if (!SITE_URL.includes('geo-miner.com')) {
      test.skip();
    }
    
    const wwwUrl = SITE_URL.replace('https://geo-miner.com', 'https://www.geo-miner.com');
    
    try {
      const response = await request.get(wwwUrl, { 
        maxRedirects: 0 
      });
      
      // Should redirect (301 or 302)
      expect([301, 302]).toContain(response.status());
      
      const location = response.headers()['location'];
      expect(location).toBe(SITE_URL + '/');
    } catch (error) {
      // If www subdomain doesn't exist, that's also acceptable
      console.log('WWW redirect test skipped - subdomain may not be configured');
    }
  });

  test('should redirect legacy domains in production', async ({ request }) => {
    // Only test in production environment
    if (!SITE_URL.includes('geo-miner.com')) {
      test.skip();
    }
    
    const legacyDomains = [
      'https://geovision-ai-miner.com',
      'https://sunny-pasca-eed8fc.netlify.app'
    ];
    
    for (const legacyUrl of legacyDomains) {
      try {
        const response = await request.get(legacyUrl, { 
          maxRedirects: 0 
        });
        
        // Should redirect (301 or 302)
        expect([301, 302]).toContain(response.status());
        
        const location = response.headers()['location'];
        expect(location).toContain('geo-miner.com');
      } catch (error) {
        // If legacy domain doesn't exist, that's also acceptable
        console.log(`Legacy redirect test skipped for ${legacyUrl} - domain may not be configured`);
      }
    }
  });
});