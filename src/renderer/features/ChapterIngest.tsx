import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterEditor } from './ChapterEditor';

// Note: Window.api interface is extended in preload.ts

interface ChapterIngestProps {
  onSave?: () => void;
  onCancel?: () => void;
}

export const ChapterIngest: React.FC<ChapterIngestProps> = ({ onSave, onCancel }) => {
  const navigate = useNavigate();
  
  const handleSave = () => {
    if (onSave) {
      // If onSave is provided, use it (for FullBook component)
      onSave();
    } else {
      // If no onSave is provided, navigate to chapters page (for standalone route)
      navigate('/chapters');
    }
  };
  
  const handleCancel = () => {
    if (onCancel) {
      // If onCancel is provided, use it (for FullBook component)
      onCancel();
    } else {
      // If no onCancel is provided, navigate to chapters page (for standalone route)
      navigate('/chapters');
    }
  };
  
  return <ChapterEditor onSave={handleSave} onCancel={handleCancel} />;
}; 