import React from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomeScreen } from './features/HomeScreen';
import { ProjectPage } from './features/ProjectPage';
import { ChapterIngest } from './features/ChapterIngest';
import { FullBook } from './features/FullBook';
import { IdeaInbox } from './features/IdeaInbox';
import { SettingsPage } from './features/SettingsPage';
import { StoryQueryChat } from './features/StoryQueryChat';
import { Toaster } from '@/components/ui/toaster';
import type { Chapter } from '@/types';

// Types are now handled in a global declaration file

const AppContent: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateProject = () => {
    // For now, just navigate to the project page
    // In the future, this could open a project creation dialog
    navigate('/project');
  };

  const handleOpenProject = () => {
    // For now, just navigate to the project page
    // In the future, this could open a file dialog
    navigate('/project');
  };

  return (
    <div className="dark bg-neutral-950 text-neutral-100 min-h-screen">
      <Routes>
        <Route 
          path="/" 
          element={
            <HomeScreen 
              onCreateProject={handleCreateProject}
              onOpenProject={handleOpenProject}
            />
          } 
        />
        <Route 
          path="/project" 
          element={
            <Layout>
              <ProjectPage />
            </Layout>
          } 
        />
        <Route 
          path="/chapters" 
          element={
            <Layout>
              <FullBook />
            </Layout>
          } 
        />
        <Route 
          path="/insert-chapter" 
          element={
            <Layout>
              <ChapterIngest />
            </Layout>
          } 
        />
        <Route 
          path="/idea-inbox" 
          element={
            <Layout>
              <IdeaInbox />
            </Layout>
          } 
        />
        <Route 
          path="/story-chat" 
          element={
            <Layout>
              <StoryQueryChat />
            </Layout>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <Layout>
              <SettingsPage />
            </Layout>
          } 
        />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
      <Toaster />
    </Router>
  );
};

export default App; 