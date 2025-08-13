import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Sites from "./pages/Sites";
import Analytics from "./pages/Analytics";
import Collaboration from "./pages/Collaboration";
import Settings from "./pages/Settings";
import Security from "./pages/Security";
import Auth from "./pages/Auth";
import EmailTest from "./pages/EmailTest";
import Debug from "./pages/Debug";
import NotFound from "./pages/NotFound";
import { PricingPage } from "./components/PricingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/email-test" element={<EmailTest />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Navigation />
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute>
                <Navigation />
                <Projects />
              </ProtectedRoute>
            } />
            <Route path="/sites" element={
              <ProtectedRoute>
                <Navigation />
                <Sites />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Navigation />
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/collaboration" element={
              <ProtectedRoute>
                <Navigation />
                <Collaboration />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Navigation />
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/security" element={
              <ProtectedRoute>
                <Navigation />
                <Security />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
