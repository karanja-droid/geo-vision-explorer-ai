import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Brain, Globe, Shield, Users, BarChart3, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="max-w-4xl mx-auto">
            <Badge variant="outline" className="mb-4 bg-blue-500/10 text-blue-400 border-blue-500/30">
              🌍 Advanced Geospatial Mining Intelligence
            </Badge>
            
            <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              GeoVision AI Miner
            </h1>
            
            <p className="text-xl lg:text-2xl text-slate-300 mb-8 leading-relaxed">
              Revolutionize geological exploration with AI-powered mineral detection, 
              satellite imagery analysis, and collaborative exploration tools.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <Link to="/auth">
                  Start 30-Day Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-16">
            Powerful Features for Modern Mining
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <Brain className="h-12 w-12 text-blue-400 mb-4" />
                <CardTitle className="text-slate-100">AI-Powered Analysis</CardTitle>
                <CardDescription className="text-slate-400">
                  Advanced machine learning models for mineral prediction with confidence scoring
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <Globe className="h-12 w-12 text-green-400 mb-4" />
                <CardTitle className="text-slate-100">3D Mapping</CardTitle>
                <CardDescription className="text-slate-400">
                  Interactive Mapbox GL JS integration with satellite imagery and spatial data
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <Users className="h-12 w-12 text-purple-400 mb-4" />
                <CardTitle className="text-slate-100">Real-Time Collaboration</CardTitle>
                <CardDescription className="text-slate-400">
                  Live team collaboration with presence tracking and messaging
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <Shield className="h-12 w-12 text-red-400 mb-4" />
                <CardTitle className="text-slate-100">Enterprise Security</CardTitle>
                <CardDescription className="text-slate-400">
                  Role-based access control, MFA, and comprehensive audit trails
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <BarChart3 className="h-12 w-12 text-yellow-400 mb-4" />
                <CardTitle className="text-slate-100">Advanced Analytics</CardTitle>
                <CardDescription className="text-slate-400">
                  Comprehensive dashboards and reporting for data-driven decisions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardHeader>
                <Zap className="h-12 w-12 text-cyan-400 mb-4" />
                <CardTitle className="text-slate-100">Project Management</CardTitle>
                <CardDescription className="text-slate-400">
                  Complete exploration lifecycle management with budget and timeline tracking
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <Card className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/30 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl lg:text-3xl text-slate-100">
                Ready to Transform Your Exploration?
              </CardTitle>
              <CardDescription className="text-lg text-slate-300">
                Start your 30-day trial and discover how AI can revolutionize your geological exploration workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                <Link to="/auth">
                  Get Started Today <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;