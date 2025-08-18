export interface Chapter {
  id: string;
  title: string;
  text: string;
  characters: string[]; // Changed from JSON string to array for web
  locations: string[]; // Changed from JSON string to array for web
  pov: string[]; // Changed from JSON string to array for web
  order?: number; // Added for drag-drop ordering
  user_id?: string; // Added for multi-user support
  created_at?: string; // Using snake_case for database consistency
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface ProjectPage {
  id: number;
  user_id: string;
  markdown: string;
  updated_at: string;
}

export interface ChapterAudio {
  id: string;
  user_id: string;
  chapter_id: string;
  audio_url?: string;
  duration?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ChapterAnalysis {
  characters: string[];
  locations: string[];
  pov: string[];
  summary: string;
  tropes?: string[];
  metadata?: {
    word_count: number;
    character_count: number;
    location_count: number;
    reading_time_minutes: number;
    sentiment: string;
  };
}

export interface EnhancedIdea {
  original: string;
  enhanced: string;
  characters?: string[];
  conflicts?: string[];
  genres?: string[];
}

// API Response types
export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// User types for authentication
export interface User {
  id: string;
  email: string;
  created_at: string;
}

