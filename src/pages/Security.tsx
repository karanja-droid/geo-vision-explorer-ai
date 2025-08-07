import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import { SecurityValidationPanel } from '@/components/security/SecurityValidationPanel';
import { SecuritySettings } from '@/components/security/SecuritySettings';
import { Shield, CheckCircle, AlertTriangle, Settings } from 'lucide-react';

const Security = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-400" />
            Security Center
          </h1>
          <p className="text-slate-400">
            Comprehensive security monitoring, validation, and configuration for GeoVision AI Miner
          </p>
        </div>
        
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border-slate-700">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Shield className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="validation" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Validation
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger 
              value="alerts" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alerts
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <SecurityDashboard />
          </TabsContent>
          
          <TabsContent value="validation" className="mt-6">
            <SecurityValidationPanel />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <SecuritySettings />
          </TabsContent>
          
          <TabsContent value="alerts" className="mt-6">
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Security Alerts</h3>
              <p className="text-slate-400">
                Real-time security alerts and notifications will be displayed here.
                Configure alert thresholds in the Settings tab.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Security;