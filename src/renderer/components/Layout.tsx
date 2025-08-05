import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Book, 
  Plus, 
  Lightbulb, 
  Settings, 
  FileText,
  MapPin,
  Users,
  BookOpen,
  Library,
  MessageCircle,
  Headphones
} from 'lucide-react';
import clsx from 'clsx';
import slugify from 'slugify';


interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projectSections, setProjectSections] = useState<Array<{label: string, slug: string}>>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Auto-save before navigation
  const triggerGlobalSave = async (): Promise<void> => {
    return new Promise((resolve) => {
      // Dispatch a global save event that SaveManagers can listen to
      const saveEvent = new CustomEvent('global-save-request', {
        detail: { resolve }
      });
      window.dispatchEvent(saveEvent);
      
      // Fallback timeout to prevent hanging
      setTimeout(resolve, 2000);
    });
  };

  // Enhanced navigation function with auto-save and loading state
  const navigateWithSave = async (path: string) => {
    // Don't block if we're already on the target path
    if (location.pathname === path) return;
    
    // Show loading state
    setIsNavigating(true);
    
    // Don't block navigation while saving - just trigger save and navigate
    // The save will happen asynchronously
    triggerGlobalSave().catch(console.error);
    
    // Navigate immediately for better UX
    navigate(path);
    
    // Clear loading state after a short delay
    setTimeout(() => setIsNavigating(false), 300);
  };

  // Default sections - will be overridden by dynamic parsing
  const defaultProjectSections = [
    { label: 'Ideas-Notes', slug: 'ideasnotes' },
    { label: 'Setting', slug: 'setting' },
    { label: 'Full Outline', slug: 'full-outline' },
    { label: 'Characters', slug: 'characters' },
  ];

  useEffect(() => {
    // Load project sections dynamically if on project page
    if (location.pathname === '/project') {
      loadProjectSections();
    }
  }, [location.pathname]);

  useEffect(() => {
    // Listen for project updates to refresh sections
    const handleProjectUpdate = () => {
      if (location.pathname === '/project') {
        loadProjectSections();
      }
    };

    window.addEventListener('projectUpdated', handleProjectUpdate);
    return () => window.removeEventListener('projectUpdated', handleProjectUpdate);
  }, [location.pathname]);

  // Auto-save when user closes app or navigates away
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Trigger sync save - don't wait for it since we can't delay unload
      triggerGlobalSave().catch(console.error);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const loadProjectSections = async () => {
    try {
      const markdown = await window.api.getProjectDoc();
      const sections = parseMarkdownHeadings(markdown);
      setProjectSections(sections.length > 0 ? sections : defaultProjectSections);
    } catch (error) {
      console.error('Failed to load project sections:', error);
      setProjectSections(defaultProjectSections);
    }
  };

  const parseMarkdownHeadings = (markdown: string): Array<{label: string, slug: string}> => {
    const headingRegex = /^## (.+)$/gm;
    const sections: Array<{label: string, slug: string}> = [];
    let match;

    while ((match = headingRegex.exec(markdown)) !== null) {
      const label = match[1].trim();
      const slug = slugify(label, { lower: true, strict: true });
      sections.push({ label, slug });
    }

    return sections;
  };

  const handleLogoClick = () => {
    const lastProjectId = localStorage.getItem('lastProjectId');
    if (lastProjectId) {
      navigateWithSave('/project');
    } else {
      navigateWithSave('/');
    }
  };

  const handleProjectSectionClick = (slug: string) => {
    navigateWithSave('/project');
    // Longer delay to ensure navigation and rendering complete
    setTimeout(() => {
      const element = document.getElementById(slug);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 200);
  };

  const handleProjectClick = () => {
    navigateWithSave('/project');
    // Longer delay to ensure navigation and rendering complete
    setTimeout(() => {
      const container = document.getElementById('project-page-container');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 200);
  };

  return (
    <div className="dark bg-neutral-950 text-neutral-100 h-screen flex">
      {/* Sidebar */}
      <div className="w-60 bg-black border-r border-neutral-900 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-neutral-900">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 text-xl font-bold text-neutral-100 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <FileText className="h-6 w-6" />
            Writegeist
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {/* Project Section - Always Expanded */}
          <div className="w-full">
            <div 
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95",
                isActive('/project') 
                  ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700' 
                  : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
              )}
              onClick={handleProjectClick}
            >
              <Book className="h-4 w-4" />
              <span>Project</span>
            </div>
            <div className="pl-7 mt-1 space-y-1">
              {projectSections.map((section) => (
                <Button
                  key={section.slug}
                  variant="ghost"
                  size="sm"
                  className={clsx(
                    "w-full justify-start gap-3 h-8 text-sm transition-all duration-200 hover:scale-105 active:scale-95",
                    isActive('/project')
                      ? 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                  )}
                  onClick={() => handleProjectSectionClick(section.slug)}
                >
                  <div className="h-2 w-2 rounded-full bg-neutral-600"></div>
                  {section.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Chapters */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/chapters')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/chapters')}
          >
            <Library className="h-4 w-4" />
            Chapters
          </Button>

          {/* Insert Chapter */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/insert-chapter')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/insert-chapter')}
          >
            <Plus className="h-4 w-4" />
            Insert Chapter
          </Button>

          {/* Idea Inbox */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/idea-inbox')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/idea-inbox')}
          >
            <Lightbulb className="h-4 w-4" />
            Idea Inbox
          </Button>

          {/* Story Query Chat */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/story-chat')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/story-chat')}
          >
            <MessageCircle className="h-4 w-4" />
            Story Chat
          </Button>

          {/* Audio Library */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/audio')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/audio')}
          >
            <Headphones className="h-4 w-4" />
            Audio Library
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10 transition-all duration-200 hover:scale-105 active:scale-95",
              isActive('/settings')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigateWithSave('/settings')}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Loading overlay */}
        {isNavigating && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-neutral-900 rounded-lg p-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm text-neutral-300">Loading...</span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}; 