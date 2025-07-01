import React from 'react';
import { Settings } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-6 w-6 text-neutral-400" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
            <p className="text-neutral-400 text-sm">Configure your writing environment</p>
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-8 text-center">
          <Settings className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-300 mb-2">Coming Soon</h3>
          <p className="text-neutral-500">
            Settings and preferences will be available here. Configure themes, AI settings, 
            export options, and more.
          </p>
        </div>
      </div>
    </div>
  );
}; 