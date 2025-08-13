/**
 * API Testing Component
 * 
 * Interactive tool for testing various API endpoints
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { API_BASE_URL } from '@/config/env';

interface ApiTest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  description: string;
  expectedStatus: number;
}

const API_TESTS: ApiTest[] = [
  {
    name: 'Health Check',
    endpoint: '/healthz',
    method: 'GET',
    description: 'Basic health check endpoint',
    expectedStatus: 200
  },
  {
    name: 'Feature Store Health',
    endpoint: '/api/v1/features/health',
    method: 'GET',
    description: 'Feature store service health',
    expectedStatus: 200
  },
  {
    name: 'AI Inference Health',
    endpoint: '/api/v1/ai/health',
    method: 'GET',
    description: 'AI inference service health',
    expectedStatus: 200
  },
  {
    name: 'Active Learning Health',
    endpoint: '/api/v1/active-learning/health',
    method: 'GET',
    description: 'Active learning service health',
    expectedStatus: 200
  },
  {
    name: 'Drill Data Health',
    endpoint: '/api/v1/drill-data/health',
    method: 'GET',
    description: 'Drill data service health',
    expectedStatus: 200
  },
  {
    name: 'STAC Catalog',
    endpoint: '/stac/catalog.json',
    method: 'GET',
    description: 'STAC catalog endpoint',
    expectedStatus: 200
  }
];

export const ApiTester: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customMethod, setCustomMethod] = useState<'GET' | 'POST'>('GET');
  const [customBody, setCustomBody] = useState('');

  const testEndpoint = async (test: ApiTest) => {
    setLoading(test.name);
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE_URL}${test.endpoint}`, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
      
      const result = {
        test: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: response.status,
        success: response.status === test.expectedStatus,
        responseTime,
        data: responseData,
        timestamp: new Date().toISOString()
      };
      
      setResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      
    } catch (error) {
      const result = {
        test: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: 0,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      setResults(prev => [result, ...prev.slice(0, 9)]);
    }
    
    setLoading(null);
  };

  const testCustomEndpoint = async () => {
    if (!customEndpoint) return;
    
    setLoading('Custom');
    const startTime = Date.now();
    
    try {
      const url = customEndpoint.startsWith('http') ? customEndpoint : `${API_BASE_URL}${customEndpoint}`;
      
      const response = await fetch(url, {
        method: customMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: customMethod === 'POST' && customBody ? customBody : undefined
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
      
      const result = {
        test: 'Custom Request',
        endpoint: customEndpoint,
        method: customMethod,
        status: response.status,
        success: response.ok,
        responseTime,
        data: responseData,
        timestamp: new Date().toISOString()
      };
      
      setResults(prev => [result, ...prev.slice(0, 9)]);
      
    } catch (error) {
      const result = {
        test: 'Custom Request',
        endpoint: customEndpoint,
        method: customMethod,
        status: 0,
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      setResults(prev => [result, ...prev.slice(0, 9)]);
    }
    
    setLoading(null);
  };

  const runAllTests = async () => {
    for (const test of API_TESTS) {
      await testEndpoint(test);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Predefined Tests */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoint Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runAllTests} disabled={!!loading}>
                {loading ? 'Testing...' : 'Run All Tests'}
              </Button>
              <Button onClick={clearResults} variant="outline">
                Clear Results
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {API_TESTS.map((test) => (
                <Card key={test.name} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">{test.name}</h4>
                      <Badge variant="outline">{test.method}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{test.description}</p>
                    <code className="text-xs bg-muted p-1 rounded">{test.endpoint}</code>
                    <Button
                      size="sm"
                      onClick={() => testEndpoint(test)}
                      disabled={loading === test.name}
                      className="w-full"
                    >
                      {loading === test.name ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Test */}
      <Card>
        <CardHeader>
          <CardTitle>Custom API Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <select
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value as 'GET' | 'POST')}
                className="px-3 py-2 border rounded"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <Input
                placeholder="/api/v1/custom-endpoint"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={testCustomEndpoint}
                disabled={!customEndpoint || loading === 'Custom'}
              >
                {loading === 'Custom' ? 'Testing...' : 'Test'}
              </Button>
            </div>
            
            {customMethod === 'POST' && (
              <Textarea
                placeholder="Request body (JSON)"
                value={customBody}
                onChange={(e) => setCustomBody(e.target.value)}
                rows={3}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <Alert key={index} className={result.success ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            {result.method}
                          </Badge>
                          <span className="font-semibold">{result.test}</span>
                          <Badge variant="outline">
                            {result.status || 'Error'}
                          </Badge>
                          {result.responseTime && (
                            <Badge variant="secondary">
                              {result.responseTime}ms
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <code className="text-xs">{result.endpoint}</code>
                      
                      {result.error && (
                        <div className="text-red-600 text-sm">
                          Error: {result.error}
                        </div>
                      )}
                      
                      {result.data && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            Response Data
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                            {typeof result.data === 'string' 
                              ? result.data 
                              : JSON.stringify(result.data, null, 2)
                            }
                          </pre>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};