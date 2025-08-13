#!/usr/bin/env node
/**
 * Sitemap Generation Script
 * 
 * Generates sitemap.xml based on SITE_URL environment variable
 */

const fs = require('fs');
const path = require('path');

// Get site URL from environment or use default
const SITE_URL = process.env.VITE_SITE_URL || 'https://geo-miner.com';

// Define static routes
const routes = [
  { path: '', priority: '1.0', changefreq: 'daily' },
  { path: '/dashboard', priority: '0.9', changefreq: 'daily' },
  { path: '/projects', priority: '0.8', changefreq: 'weekly' },
  { path: '/sites', priority: '0.8', changefreq: 'weekly' },
  { path: '/minerals', priority: '0.8', changefreq: 'weekly' },
  { path: '/predictions', priority: '0.7', changefreq: 'weekly' },
  { path: '/analytics', priority: '0.7', changefreq: 'weekly' },
  { path: '/drill-data', priority: '0.7', changefreq: 'weekly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
];

// Generate sitemap XML
function generateSitemap() {
  const currentDate = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  routes.forEach(route => {
    sitemap += `
  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  });

  sitemap += `
</urlset>`;

  return sitemap;
}

// Write sitemap to public directory
function writeSitemap() {
  const sitemap = generateSitemap();
  const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
  
  fs.writeFileSync(outputPath, sitemap, 'utf8');
  console.log(`✓ Sitemap generated: ${outputPath}`);
  console.log(`✓ Site URL: ${SITE_URL}`);
  console.log(`✓ Routes: ${routes.length}`);
}

// Run if called directly
if (require.main === module) {
  writeSitemap();
}

module.exports = { generateSitemap, writeSitemap };