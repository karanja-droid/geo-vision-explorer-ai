/**
 * SEO and Meta Tag Configuration
 * 
 * Utilities for managing SEO meta tags, canonical URLs, and social media tags.
 */

import { SITE_URL } from '@/config/env';

export interface SEOConfig {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

/**
 * Default SEO configuration
 */
export const DEFAULT_SEO: SEOConfig = {
  title: 'GeoVision AI Miner - Enterprise Geological Intelligence Platform',
  description: 'AI-powered geological exploration and mining intelligence platform with real-time data processing, 3D visualization, and predictive analytics.',
  ogType: 'website',
  twitterCard: 'summary_large_image',
};

/**
 * Generate canonical URL
 */
export function getCanonicalUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${cleanPath}`;
}

/**
 * Generate meta tags for SEO
 */
export function generateMetaTags(config: SEOConfig = {}): string {
  const seo = { ...DEFAULT_SEO, ...config };
  const canonical = seo.canonical || getCanonicalUrl();
  
  const tags = [
    // Basic meta tags
    seo.title && `<title>${seo.title}</title>`,
    seo.description && `<meta name="description" content="${seo.description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    
    // Open Graph tags
    seo.ogTitle && `<meta property="og:title" content="${seo.ogTitle || seo.title}" />`,
    seo.ogDescription && `<meta property="og:description" content="${seo.ogDescription || seo.description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    seo.ogType && `<meta property="og:type" content="${seo.ogType}" />`,
    seo.ogImage && `<meta property="og:image" content="${seo.ogImage}" />`,
    `<meta property="og:site_name" content="GeoVision AI Miner" />`,
    
    // Twitter Card tags
    seo.twitterCard && `<meta name="twitter:card" content="${seo.twitterCard}" />`,
    seo.twitterTitle && `<meta name="twitter:title" content="${seo.twitterTitle || seo.title}" />`,
    seo.twitterDescription && `<meta name="twitter:description" content="${seo.twitterDescription || seo.description}" />`,
    seo.twitterImage && `<meta name="twitter:image" content="${seo.twitterImage || seo.ogImage}" />`,
    
    // Additional SEO tags
    '<meta name="robots" content="index, follow" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta charset="utf-8" />',
  ];

  return tags.filter(Boolean).join('\n');
}

/**
 * Update document head with SEO tags
 */
export function updateDocumentHead(config: SEOConfig = {}): void {
  const seo = { ...DEFAULT_SEO, ...config };
  
  // Update title
  if (seo.title) {
    document.title = seo.title;
  }
  
  // Update or create meta tags
  const updateMetaTag = (name: string, content: string, property = false) => {
    const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let meta = document.querySelector(selector) as HTMLMetaElement;
    
    if (!meta) {
      meta = document.createElement('meta');
      if (property) {
        meta.setAttribute('property', name);
      } else {
        meta.setAttribute('name', name);
      }
      document.head.appendChild(meta);
    }
    
    meta.setAttribute('content', content);
  };
  
  // Update canonical link
  const updateCanonicalLink = (href: string) => {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    
    link.setAttribute('href', href);
  };
  
  // Apply updates
  if (seo.description) updateMetaTag('description', seo.description);
  if (seo.ogTitle) updateMetaTag('og:title', seo.ogTitle, true);
  if (seo.ogDescription) updateMetaTag('og:description', seo.ogDescription, true);
  if (seo.ogImage) updateMetaTag('og:image', seo.ogImage, true);
  if (seo.ogType) updateMetaTag('og:type', seo.ogType, true);
  if (seo.twitterCard) updateMetaTag('twitter:card', seo.twitterCard);
  if (seo.twitterTitle) updateMetaTag('twitter:title', seo.twitterTitle);
  if (seo.twitterDescription) updateMetaTag('twitter:description', seo.twitterDescription);
  if (seo.twitterImage) updateMetaTag('twitter:image', seo.twitterImage);
  
  const canonical = seo.canonical || getCanonicalUrl(window.location.pathname);
  updateCanonicalLink(canonical);
  updateMetaTag('og:url', canonical, true);
}

/**
 * Generate sitemap URLs
 */
export function generateSitemapUrls(): string[] {
  const baseUrls = [
    '',
    '/dashboard',
    '/projects',
    '/sites',
    '/minerals',
    '/predictions',
    '/analytics',
    '/drill-data',
    '/about',
    '/contact',
  ];
  
  return baseUrls.map(path => getCanonicalUrl(path));
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${getCanonicalUrl('/sitemap.xml')}

# Disallow admin and API endpoints
Disallow: /admin/
Disallow: /api/
Disallow: /_next/
Disallow: /static/`;
}