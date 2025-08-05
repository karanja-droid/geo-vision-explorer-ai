import React from 'react';
import GeospatialViewer from '@/components/GeospatialViewer';
import AIAnalysisPanel from '@/components/AIAnalysisPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Analytics = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Advanced Analytics</h1>
          <p className="text-slate-400">AI-powered geological analysis and visualization</p>
        </div>
        
        <Tabs defaultValue="geospatial" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50 border-slate-700">
            <TabsTrigger 
              value="geospatial" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Geospatial Analysis
            </TabsTrigger>
            <TabsTrigger 
              value="ai-analysis" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              AI Analysis
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="geospatial" className="mt-6">
            <GeospatialViewer />
          </TabsContent>
          
          <TabsContent value="ai-analysis" className="mt-6">
            <AIAnalysisPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;