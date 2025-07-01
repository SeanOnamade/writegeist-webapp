import React from 'react';
import { Lightbulb } from 'lucide-react';

export const IdeaInbox: React.FC = () => {
  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Idea Inbox</h1>
            <p className="text-neutral-400 text-sm">Capture and organize your creative ideas</p>
          </div>
        </div>
        
        <div className="bg-neutral-800 rounded-lg p-8 text-center">
          <Lightbulb className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-300 mb-2">Coming Soon</h3>
          <p className="text-neutral-500">
            The idea inbox feature is under development. This will be your space to capture 
            spontaneous ideas, plot points, and character insights.
          </p>
        </div>
      </div>
    </div>
  );
}; 