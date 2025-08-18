// Writegeist Web Migration - Database Types
// Auto-generated TypeScript types matching the Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audio_files: {
        Row: {
          chapter_id: string
          created_at: string
          duration: number | null
          error_message: string | null
          file_name: string
          file_path: string
          file_size: number | null
          generation_settings: Json
          id: string
          status: Database["public"]["Enums"]["audio_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          duration?: number | null
          error_message?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          generation_settings?: Json
          id?: string
          status?: Database["public"]["Enums"]["audio_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          duration?: number | null
          error_message?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          generation_settings?: Json
          id?: string
          status?: Database["public"]["Enums"]["audio_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          content: string
          content_file_path: string | null
          created_at: string
          id: string
          metadata: Json
          order_index: number
          project_id: string
          status: Database["public"]["Enums"]["chapter_status"]
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          content?: string
          content_file_path?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_index: number
          project_id: string
          status?: Database["public"]["Enums"]["chapter_status"]
          title: string
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          content?: string
          content_file_path?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          order_index?: number
          project_id?: string
          status?: Database["public"]["Enums"]["chapter_status"]
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context: Json
          created_at: string
          id: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          project_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_embeddings: {
        Row: {
          chapter_id: string | null
          content_hash: string
          content_text: string
          content_type: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          content_hash: string
          content_text: string
          content_type: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          content_hash?: string
          content_text?: string
          content_type?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_embeddings_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          project_id: string | null
          status: Database["public"]["Enums"]["idea_status"]
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ingested_documents: {
        Row: {
          content_text: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          metadata: Json
          processing_status: string
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_text?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          metadata?: Json
          processing_status?: string
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_text?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          metadata?: Json
          processing_status?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingested_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingested_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          chapter_count: number
          created_at: string
          description: string | null
          id: string
          metadata: Json
          settings: Json
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
          user_id: string
          word_count: number
        }
        Insert: {
          chapter_count?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          settings?: Json
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
          user_id: string
          word_count?: number
        }
        Update: {
          chapter_count?: number
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          settings?: Json
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_documents: {
        Args: {
          query_embedding: string
          match_threshold: number
          match_count: number
          filter_user_id?: string
          filter_project_id?: string
        }
        Returns: {
          id: string
          content_text: string
          content_type: string
          similarity: number
          metadata: Json
        }[]
      }
    }
    Enums: {
      audio_status: "pending" | "processing" | "completed" | "failed"
      chapter_status: "draft" | "in_progress" | "completed" | "published"
      idea_status: "new" | "in_progress" | "used" | "archived"
      project_status: "active" | "archived" | "draft"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types for common operations
export type User = Database['public']['Tables']['users']['Row']
export type Project = Database['public']['Tables']['projects']['Row']
export type Chapter = Database['public']['Tables']['chapters']['Row']
export type Idea = Database['public']['Tables']['ideas']['Row']
export type AudioFile = Database['public']['Tables']['audio_files']['Row']
export type ChatSession = Database['public']['Tables']['chat_sessions']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type DocumentEmbedding = Database['public']['Tables']['document_embeddings']['Row']
export type IngestedDocument = Database['public']['Tables']['ingested_documents']['Row']

// Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ChapterInsert = Database['public']['Tables']['chapters']['Insert']
export type IdeaInsert = Database['public']['Tables']['ideas']['Insert']
export type AudioFileInsert = Database['public']['Tables']['audio_files']['Insert']
export type ChatSessionInsert = Database['public']['Tables']['chat_sessions']['Insert']
export type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']

// Update types
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']
export type ChapterUpdate = Database['public']['Tables']['chapters']['Update']
export type IdeaUpdate = Database['public']['Tables']['ideas']['Update']
export type AudioFileUpdate = Database['public']['Tables']['audio_files']['Update']
export type ChatSessionUpdate = Database['public']['Tables']['chat_sessions']['Update']

// Enum types
export type ProjectStatus = Database['public']['Enums']['project_status']
export type ChapterStatus = Database['public']['Enums']['chapter_status']
export type AudioStatus = Database['public']['Enums']['audio_status']
export type IdeaStatus = Database['public']['Enums']['idea_status']

