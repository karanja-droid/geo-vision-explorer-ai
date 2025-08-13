import '@testing-library/jest-dom';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { data } from 'vis-network';
import { vi } from 'vitest';

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    VITE_MAPBOX_TOKEN: 'test-mapbox-token',
    VITE_SENTRY_DSN: 'test-sentry-dsn',
    VITE_ENVIRONMENT: 'test',
    DEV: false,
    PROD: false,
  },
}));

// Mock Mapbox GL JS
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      addControl: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getLayer: vi.fn(),
      getSource: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
      setStyle: vi.fn(),
      queryRenderedFeatures: vi.fn(() => []),
    })),
    NavigationControl: vi.fn(),
    FullscreenControl: vi.fn(),
    Popup: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
    })),
    LngLatBounds: vi.fn(() => ({
      extend: vi.fn(),
    })),
  },
  accessToken: '',
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
  Radar: () => <div data-testid="radar" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
}));

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    functions: {
      invoke: vi.fn(),
    },
    rpc: vi.fn(),
  },
}));

// Mock Redis client
vi.mock('@/integrations/redis/client', () => ({
  getRedisService: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    getJSON: vi.fn(),
    setJSON: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
  })),
}));

// Mock Neo4j client
vi.mock('@/integrations/neo4j/client', () => ({
  getNeo4jService: vi.fn(() => ({
    run: vi.fn(),
    close: vi.fn(),
    executeQuery: vi.fn(),
    getRelationships: vi.fn(),
    findShortestPath: vi.fn(),
  })),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test utilities
export const createMockUser = () => ({
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    role: 'geologist',
  },
  created_at: new Date().toISOString(),
});

export const createMockProject = () => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  location: 'Test Location',
  status: 'active',
  budget: 1000000,
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  coordinates: 'POINT(-116.5 40.5)',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'test-user-id',
});

export const createMockSite = () => ({
  id: 'test-site-id',
  project_id: 'test-project-id',
  name: 'Test Site',
  description: 'Test site description',
  coordinates: 'POINT(-116.48 40.52)',
  elevation: 1850.5,
  site_type: 'outcrop' as const,
  access_notes: 'Test access notes',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const createMockDeposit = () => ({
  id: 'test-deposit-id',
  site_id: 'test-site-id',
  mineral_type: 'Gold',
  grade: 8.5,
  tonnage: 125000,
  confidence_level: 85,
  discovery_date: '2024-01-20',
  coordinates: 'POINT(-116.48 40.52)',
  depth: 15.5,
  notes: 'Test deposit notes',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const createMockPrediction = () => ({
  id: 'test-prediction-id',
  deposit_id: 'test-deposit-id',
  model_name: 'DeepMine-v2.1',
  confidence_score: 0.89,
  predicted_grade: 8.2,
  predicted_tonnage: 130000,
  status: 'completed' as const,
  metadata: {
    algorithm: 'CNN',
    training_data_size: 15000,
    processing_time_ms: 2500,
    model_version: '2.1.3',
    accuracy_score: 0.91,
    cross_validation_score: 0.87,
  },
  features_used: [
    'geological_formation',
    'rock_type',
    'alteration_zones',
    'geochemical_signatures',
    'structural_features',
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// Mock environment variables for tests
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-key',
    VITE_MAPBOX_TOKEN: 'test-token',
    VITE_REDIS_HOST: 'localhost',
    VITE_REDIS_PORT: '6379',
    VITE_NEO4J_URI: 'bolt://localhost:7687',
    VITE_NEO4J_USERNAME: 'neo4j',
    VITE_NEO4J_PASSWORD: 'password',
  },
  writable: true,
})