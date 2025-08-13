# Project Structure

## Root Directory
- `src/` - Main application source code
- `public/` - Static assets (favicon, robots.txt, placeholder.svg)
- `supabase/` - Database migrations and edge functions
- `.kiro/` - Kiro IDE configuration and steering rules
- Configuration files: `package.json`, `vite.config.ts`, `tailwind.config.ts`, etc.

## Source Code Organization (`src/`)

### Core Application
- `main.tsx` - Application entry point with React 18 StrictMode
- `App.tsx` - Root component with routing, providers, and global setup
- `App.css` - Global styles and CSS custom properties
- `index.css` - Tailwind imports and base styles

### Components (`src/components/`)
- **Feature Components**: Domain-specific components (e.g., `ProjectDashboard.tsx`, `SiteManagement.tsx`)
- **UI Components** (`ui/`): Reusable shadcn/ui components with consistent API
- **Security Components** (`security/`): Specialized security-related components
- **Shared Components**: Cross-cutting components like `Navigation.tsx`, `ProtectedRoute.tsx`

### Pages (`src/pages/`)
Route-based page components following React Router structure:
- `Dashboard.tsx` - Main dashboard page
- `Projects.tsx`, `Sites.tsx` - Core feature pages
- `Auth.tsx` - Authentication flows
- `Security.tsx`, `Settings.tsx` - Configuration pages
- `NotFound.tsx` - 404 error page

### Custom Hooks (`src/hooks/`)
Domain-specific React hooks for:
- **Authentication**: `useAuth.tsx` - User session and auth state
- **Data Management**: `useProjects.tsx`, `useSites.tsx`, `useMineralDeposits.tsx`
- **Features**: `useAIAnalysis.tsx`, `useCollaboration.tsx`, `useSubscription.tsx`
- **Security**: `useRolePermissions.tsx`, `useSecurityAudit.tsx`
- **UI**: `use-mobile.tsx`, `use-toast.ts`

### Integrations (`src/integrations/`)
- `supabase/` - Database client and TypeScript types
  - `client.ts` - Configured Supabase client
  - `types.ts` - Auto-generated database types

### Utilities (`src/lib/` & `src/utils/`)
- `lib/utils.ts` - Common utility functions and cn() helper
- `utils/sampleData.ts` - Mock data for development
- `utils/securityValidation.ts` - Security validation helpers

## Database Structure (`supabase/`)

### Migrations (`supabase/migrations/`)
- Chronologically ordered SQL migration files
- Includes table creation, RLS policies, and schema updates
- PostGIS spatial data support

### Edge Functions (`supabase/functions/`)
- `get-mapbox-token/` - Secure Mapbox token retrieval
- `security-audit/` - Security monitoring functions
- `encryption-key-rotation/` - Key management
- `rate-limited-query/` - Query rate limiting

## Naming Conventions

### Files
- **Components**: PascalCase (e.g., `ProjectDashboard.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useProjects.tsx`)
- **Pages**: PascalCase matching route names
- **Utils**: camelCase (e.g., `sampleData.ts`)

### Components
- Use descriptive, domain-specific names
- Group related components in subdirectories
- Export as default for main components, named exports for utilities

### Imports
- Use absolute imports with `@/` alias
- Group imports: React, third-party, internal components, hooks, utils
- Consistent import order across files

## Architecture Patterns

### Component Structure
- Functional components with TypeScript
- Custom hooks for business logic
- Props interfaces defined inline or exported
- Consistent error boundaries and loading states

### State Management
- TanStack Query for server state
- React Context for global app state (auth, theme)
- Local state with useState/useReducer for component state
- Custom hooks encapsulate complex state logic

### Security Architecture
- Row Level Security (RLS) at database level
- Role-based permissions with granular controls
- Protected routes with authentication checks
- Audit logging for sensitive operations