import React from 'react';
import RealtimeCollaboration from '@/components/RealtimeCollaboration';

const Collaboration = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Team Collaboration</h1>
          <p className="text-slate-400">Real-time collaboration with your team</p>
        </div>
        
        <RealtimeCollaboration />
      </div>
    </div>
  );
};

export default Collaboration;