import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  Library
} from 'lucide-react';
import clsx from 'clsx';
import slugify from 'slugify';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [projectSections, setProjectSections] = useState<Array<{label: string, slug: string}>>([]);
  const [open, setOpen] = useLocalStorage("sidebar-project-open", "project");

  const isActive = (path: string) => location.pathname === path;

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
      navigate('/project');
    } else {
      navigate('/');
    }
  };

  const handleProjectSectionClick = (slug: string) => {
    navigate('/project');
    // Small delay to ensure navigation completes before scrolling
    setTimeout(() => {
      const element = document.getElementById(slug);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="dark bg-neutral-950 text-neutral-100 h-screen flex">
      {/* Sidebar */}
      <div className="w-60 bg-black border-r border-neutral-900 flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-neutral-900">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-2 text-xl font-bold text-neutral-100 hover:text-white transition-colors"
          >
            <FileText className="h-6 w-6" />
            Writegeist
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {/* Project Section with Accordion */}
          <Accordion type="single" value={open} onValueChange={setOpen} collapsible className="w-full">
            <AccordionItem value="project" className="border-none">
              <AccordionTrigger 
                className={clsx(
                  "flex items-center justify-between w-full px-3 py-2 text-left rounded-md transition-colors hover:no-underline",
                  isActive('/project') 
                    ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700' 
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
                )}
              >
                <div className="flex items-center gap-3">
                  <Book className="h-4 w-4" />
                  <span>Project</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0 pt-1">
                <div className="pl-7 space-y-1">
                  {projectSections.map((section) => (
                    <Button
                      key={section.slug}
                      variant="ghost"
                      size="sm"
                      className={clsx(
                        "w-full justify-start gap-3 h-8 text-sm",
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Chapters */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10",
              isActive('/chapters')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigate('/chapters')}
          >
            <Library className="h-4 w-4" />
            Chapters
          </Button>

          {/* Insert Chapter */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10",
              isActive('/insert-chapter')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigate('/insert-chapter')}
          >
            <Plus className="h-4 w-4" />
            Insert Chapter
          </Button>

          {/* Idea Inbox */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10",
              isActive('/idea-inbox')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigate('/idea-inbox')}
          >
            <Lightbulb className="h-4 w-4" />
            Idea Inbox
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            className={clsx(
              "w-full justify-start gap-3 h-10",
              isActive('/settings')
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            )}
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-4 w-4" />
            Settings
              </Button>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}; 