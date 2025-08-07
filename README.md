# GeoVision AI Miner 🌍⚡

> **Advanced Geospatial Mining Intelligence Platform**

GeoVision AI Miner is a cutting-edge geospatial intelligence platform designed for geological exploration and mining operations. Combining AI-driven mineral detection, satellite imagery analysis, and collaborative exploration tools, it empowers geologists and mining professionals to make data-driven decisions with unprecedented accuracy.

## ✨ Key Features

### 🎯 **AI-Powered Mineral Analysis**
- Advanced machine learning models for mineral prediction and classification
- Confidence scoring and geological analysis reports
- Real-time prediction status tracking with detailed metadata

### 🗺️ **Interactive 3D Mapping**
- Mapbox GL JS integration with stunning 3D globe visualization
- Satellite imagery overlay and geospatial data visualization
- PostGIS spatial data support for precise geological mapping

### 🏗️ **Project & Site Management**
- Comprehensive exploration project lifecycle management
- Geological site tracking with elevation data and access notes
- Multi-mineral targeting with budget and timeline management

### 👥 **Real-Time Collaboration**
- Live team collaboration with presence tracking
- Real-time messaging and session management
- Activity logging for complete audit trails

### 📊 **Advanced Analytics**
- Comprehensive metrics dashboards and reporting
- Usage analytics and performance monitoring
- Subscription-based feature gating with trial support

### 🔐 **Enterprise Security**
- Row-Level Security (RLS) with role-based access control
- Multi-tenant architecture with user isolation
- Secure authentication and authorization

## 🛠️ Technology Stack

### **Frontend**
- **React 18** - Modern component-based UI framework
- **TypeScript** - Type-safe development experience
- **Vite** - Lightning-fast development server and build tool
- **Tailwind CSS** - Utility-first CSS framework with design system
- **shadcn/ui** - High-quality, accessible component library
- **TanStack Query** - Server state management and caching
- **React Router** - Client-side routing and navigation

### **Backend & Database**
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **PostGIS** - Spatial database extension for geographical data
- **Row Level Security (RLS)** - Database-level security policies
- **Supabase Auth** - Authentication and user management
- **Edge Functions** - Serverless functions for custom logic

### **Mapping & Visualization**
- **Mapbox GL JS** - Interactive maps and 3D visualization
- **Recharts** - Data visualization and charting library

### **Real-time Features**
- **Supabase Realtime** - Live data synchronization
- **WebSocket connections** - Real-time collaboration features

## 📋 Core Modules

### **1. Project Management**
- Multi-project exploration campaigns
- Status tracking (planning, active, completed, on_hold)
- Geographic boundary management with coordinate systems
- Budget allocation and timeline management

### **2. Site & Mineral Management**
- Geological exploration sites with spatial coordinates
- Mineral deposit tracking with grade and tonnage estimates
- Confidence level assessments and discovery date logging
- Comprehensive geochemistry data storage

### **3. AI Analysis Engine**
- Multiple AI model support with version tracking
- Performance metrics and training data management
- Prediction workflows with status management
- Confidence scoring and result validation

### **4. Collaboration Platform**
- Real-time collaboration sessions
- User presence tracking and cursor positions
- Activity logging with IP tracking and user agents
- Message threading and project-based communication

### **5. Subscription & Usage Management**
- Tiered subscription plans (Individual, Starter Team, Corporate, Enterprise)
- 30-day trial system with automatic activation
- Usage metrics tracking and quota management
- Feature flagging based on subscription tiers

## 🗄️ Database Architecture

### **Core Tables**
- `projects` - Exploration project management
- `exploration_sites` - Geological site data with PostGIS geometry
- `mineral_deposits` - Mineral classification and analysis
- `predictions` - AI model predictions and results
- `ai_models` - Model versioning and performance tracking

### **User Management**
- `profiles` - Extended user information with role management
- `activity_logs` - Comprehensive audit trail
- `user_presence` - Real-time collaboration features

### **Collaboration**
- `collaboration_sessions` - Team session management
- `collaboration_messages` - Real-time messaging
- `user_presence` - Live user tracking

### **Business Logic**
- `feature_flags` - Feature toggling and A/B testing
- `subscriptions` - Billing and trial management
- `usage_metrics` - Resource consumption tracking

### **Spatial Data Support**
- PostGIS geometry types for precise mapping
- Spatial indexing for performance optimization
- Coordinate system management (SRID support)

## 👥 User Roles & Permissions

### **Geologist** (Default)
- Create and manage own projects
- Access AI analysis tools
- Collaborate with team members
- View own data and shared projects

### **Admin**
- Full system access and user management
- Override permissions and data access
- Manage feature flags and system configuration
- Access all projects and analytics

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ and npm
- Supabase account and project
- Mapbox account for mapping features

### **Local Development Setup**

1. **Clone the repository:**
```bash
git clone <YOUR_GIT_URL>
cd geovision-ai-miner
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
# Supabase configuration is already set up in src/integrations/supabase/client.ts
# For Mapbox, add your token to Supabase Edge Function Secrets
```

4. **Start development server:**
```bash
npm run dev
```

5. **Access the application:**
- Open http://localhost:5173
- Sign up for a new account to start your 30-day trial

### **Database Setup**
The database schema is automatically managed through Supabase migrations:
- All tables include proper RLS policies
- PostGIS extension enabled for spatial data
- Automatic user profile creation on signup
- Feature flags and subscription management configured

## 🌍 Deployment

### **Production Deployment**
1. **Via Lovable Platform:**
   - Open [Lovable Project](https://lovable.dev/projects/916d7245-75f4-4e7c-8934-57d8262f0463)
   - Click Share → Publish
   - Configure custom domain if needed

2. **Manual Deployment:**
   - Build: `npm run build`
   - Deploy `dist/` folder to your hosting provider
   - Configure environment variables for production

### **Environment Configuration**
- **Supabase URL**: `https://rgtyhffyvpqenrqnkfqc.supabase.co`
- **Supabase Anon Key**: Configured in client
- **Mapbox Token**: Set in Supabase Edge Function Secrets

## 📊 Feature Tiers

### **Individual** - $7.99/month
- 5 projects, 20 sites per project
- 100 AI predictions/month
- Basic collaboration (2 team members)

### **Starter Team** - $19.99/month
- 15 projects, 50 sites per project
- 500 AI predictions/month
- Enhanced collaboration (5 team members)

### **Corporate** - $49.99/month
- 50 projects, 200 sites per project
- 2000 AI predictions/month
- Advanced collaboration (20 team members)
- Priority support

### **Enterprise** - Custom Pricing
- Unlimited projects and sites
- Unlimited AI predictions
- White-label options
- Dedicated support

## 🔧 Development Workflow

### **Code Organization**
- `src/components/` - Reusable UI components
- `src/pages/` - Route-based page components
- `src/hooks/` - Custom React hooks
- `src/integrations/` - External service integrations
- `supabase/` - Database migrations and functions

### **Key Development Patterns**
- Feature-based component organization
- Custom hooks for data fetching and state management
- Row Level Security for data protection
- Real-time subscriptions for live features

## 📚 API Documentation

### **Supabase Integration**
- Database queries through generated TypeScript types
- Real-time subscriptions for live updates
- Edge functions for complex business logic
- Authentication and authorization

### **External APIs**
- Mapbox GL JS for mapping and visualization
- Custom edge functions for AI model integration

## 🤝 Contributing

This project is built using modern React and TypeScript patterns:
- Follow the established component structure
- Use the existing design system and Tailwind configuration
- Implement proper TypeScript types
- Add appropriate RLS policies for new features

## 📞 Support & Documentation

- **Project URL**: https://lovable.dev/projects/916d7245-75f4-4e7c-8934-57d8262f0463
- **Documentation**: Built-in help system and tooltips
- **Support**: Available through the platform contact system

---

**Built with ❤️ using Lovable, Supabase, and modern web technologies**
