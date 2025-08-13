/**
 * API Client Configuration
 * 
 * Centralized API client with environment-based configuration and error handling.
 */

import { API_BASE_URL, API_ENDPOINTS } from '@/config/env';

// Runtime validation
if (!API_BASE_URL) {
  throw new Error('API_BASE_URL is required but not configured');
}

/**
 * Base fetch wrapper with error handling and authentication
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authentication token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers: defaultHeaders,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return response.text() as unknown as T;
  } catch (error) {
    console.error('API Request failed:', { url, error });
    throw error;
  }
}

/**
 * API Client Methods
 */
export const apiClient = {
  // Health check
  async healthCheck() {
    return apiRequest<{ status: string; baseUrl: string }>(API_ENDPOINTS.HEALTH);
  },

  // Feature Store
  async getFeatures(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest(`${API_ENDPOINTS.FEATURES}${query}`);
  },

  async computeFeatures(data: any) {
    return apiRequest(API_ENDPOINTS.FEATURES, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // AI Inference
  async runInference(data: any) {
    return apiRequest(`${API_ENDPOINTS.AI_INFERENCE}/run`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getInferenceStatus(taskId: string) {
    return apiRequest(`${API_ENDPOINTS.AI_INFERENCE}/status/${taskId}`);
  },

  // Active Learning
  async getLabels(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest(`${API_ENDPOINTS.ACTIVE_LEARNING}/labels${query}`);
  },

  async submitLabels(data: any) {
    return apiRequest(`${API_ENDPOINTS.ACTIVE_LEARNING}/labels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Drill Data
  async uploadDrillData(formData: FormData) {
    return apiRequest(`${API_ENDPOINTS.DRILL_DATA}/upload`, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  },

  async startQAValidation(data: any) {
    return apiRequest(`${API_ENDPOINTS.DRILL_DATA}/qa/validate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getQAResults(params?: Record<string, any>) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiRequest(`${API_ENDPOINTS.DRILL_DATA}/qa/results${query}`);
  },

  // STAC Catalog
  async getSTACCatalog() {
    return apiRequest(`${API_ENDPOINTS.STAC}/catalog.json`);
  },

  async getSTACCollection(collectionId: string) {
    return apiRequest(`${API_ENDPOINTS.STAC}/collections/${collectionId}`);
  },

  async getSTACItem(collectionId: string, itemId: string) {
    return apiRequest(`${API_ENDPOINTS.STAC}/collections/${collectionId}/items/${itemId}`);
  },
};

/**
 * Upload helper with progress tracking
 */
export async function uploadWithProgress(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100;
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    xhr.open('POST', url);
    
    // Add authentication if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.send(formData);
  });
}

export default apiClient;