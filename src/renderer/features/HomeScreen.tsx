import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, FolderOpen } from 'lucide-react';

interface HomeScreenProps {
  onCreateProject: () => void;
  onOpenProject: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ 
  onCreateProject, 
  onOpenProject 
}) => {
  useEffect(() => {
    // Auto-open last project if it exists
    const lastProjectId = localStorage.getItem('lastProjectId');
    if (lastProjectId) {
      onOpenProject();
    }
  }, [onOpenProject]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-neutral-950 p-8">
      <div className="max-w-lg w-full text-center space-y-12">
        <div className="space-y-6">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">Writegeist</h1>
            <p className="text-xl text-neutral-300">Your creative writing companion</p>
          </div>
        </div>
        
        <div className="space-y-6">
          <Button
            onClick={onCreateProject}
            className="w-full h-14 text-xl gap-4 bg-white text-black hover:bg-neutral-100 transition-all duration-200 shadow-lg hover:shadow-xl"
            size="lg"
          >
            <FileText className="h-6 w-6" />
            Create New Project
          </Button>
          
          <Button
            onClick={onOpenProject}
            variant="outline"
            className="w-full h-14 text-xl gap-4 border-2 border-neutral-700 text-neutral-100 hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-200"
            size="lg"
          >
            <FolderOpen className="h-6 w-6" />
            Open Existing Project
          </Button>
        </div>
        
        <div className="text-base text-neutral-400 pt-8">
          <p>Get started by creating a new project or opening an existing one.</p>
        </div>
      </div>
    </div>
  );
}; 