# Technology Stack

## Frontend Framework
- **React 18** with TypeScript for type-safe development
- **Vite** as build tool and development server
- **React Router DOM** for client-side routing
- **TanStack Query** for server state management and caching

## UI & Styling
- **Tailwind CSS** utility-first CSS framework with custom design system
- **shadcn/ui** component library built on Radix UI primitives
- **Lucide React** for consistent iconography
- **next-themes** for dark/light mode support
- **CSS Variables** for theming with HSL color system

## Backend & Database
- **Supabase** as Backend-as-a-Service with PostgreSQL
- **PostGIS** extension for spatial/geographical data
- **Row Level Security (RLS)** for data access control
- **Supabase Auth** for authentication and user management
- **Supabase Edge Functions** for serverless backend logic

## Key Libraries
- **React Hook Form** with Zod validation for forms
- **Mapbox GL JS** for interactive 3D mapping and visualization
- **Recharts** for data visualization and analytics
- **date-fns** for date manipulation
- **class-variance-authority** and **clsx** for conditional styling

## Development Tools
- **TypeScript** with relaxed configuration (noImplicitAny: false)
- **ESLint** with React hooks and TypeScript rules
- **Lovable Tagger** for development mode component tagging

## Common Commands

### Development
```bash
npm run dev          # Start development server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Path Aliases
- `@/*` maps to `./src/*` for clean imports
- Components use absolute imports: `@/components/ui/button`
- Hooks: `@/hooks/useAuth`
- Utils: `@/lib/utils`

## Configuration Notes
- Vite server configured for host "::" (all interfaces) on port 8080
- TypeScript strict mode partially disabled for faster development
- Supabase client configured with localStorage persistence
- Tailwind configured with custom color system and animations