import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import { HelpButton } from "@/components/help/HelpButton";
import { HelpSearchShortcut } from "@/components/help/HelpSearchDialog";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Sites from "./pages/Sites";
import Analytics from "./pages/Analytics";
import Collaboration from "./pages/Collaboration";
import DataEntry from "./pages/DataEntry";
import Executive from "./pages/Executive";
import Geologist from "./pages/Geologist";
import Driller from "./pages/Driller";
import Settings from "./pages/Settings";
import Security from "./pages/Security";
import Auth from "./pages/Auth";
import EmailTest from "./pages/EmailTest";
import Debug from "./pages/Debug";
import NotFound from "./pages/NotFound";
import { PricingPage } from "./components/PricingPage";
import "@/styles/contextual-help.css";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="system" storageKey="geo-vision-theme">
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
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/projects" element={
              <ProtectedRoute>
                <Navigation />
                <Projects />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/sites" element={
              <ProtectedRoute>
                <Navigation />
                <Sites />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <Navigation />
                <Analytics />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/collaboration" element={
              <ProtectedRoute>
                <Navigation />
                <Collaboration />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/data-entry" element={
              <ProtectedRoute>
                <Navigation />
                <DataEntry />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/executive" element={
              <ProtectedRoute>
                <Navigation />
                <Executive />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/geologist" element={
              <ProtectedRoute>
                <Navigation />
                <Geologist />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/driller" element={
              <ProtectedRoute>
                <Navigation />
                <Driller />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Navigation />
                <Settings />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="/security" element={
              <ProtectedRoute>
                <Navigation />
                <Security />
                <HelpButton />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <HelpSearchShortcut />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
