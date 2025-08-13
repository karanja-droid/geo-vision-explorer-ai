#!/usr/bin/env node

// Simple health check script for GeoVision AI Miner
const http = require('http');

const checkEndpoint = (url, name) => {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      console.log(`✅ ${name}: ${res.statusCode}`);
      resolve(res.statusCode === 200);
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${name}: ${err.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log(`⏰ ${name}: Timeout`);
      req.destroy();
      resolve(false);
    });
  });
};

async function healthCheck() {
  console.log('🏥 GeoVision AI Miner Health Check');
  console.log('=====================================');
  
  const checks = [
    { url: 'http://localhost:8080', name: 'Frontend Dev Server' },
    { url: 'http://localhost:6379', name: 'Redis Server' },
    { url: 'http://localhost:7474', name: 'Neo4j Browser' },
  ];
  
  for (const check of checks) {
    await checkEndpoint(check.url, check.name);
  }
  
  console.log('=====================================');
  console.log('Health check complete!');
}

healthCheck();