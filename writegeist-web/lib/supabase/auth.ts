import { supabase } from './client'
import type { User } from '@supabase/supabase-js'

export interface AuthResponse {
  user?: User | null
  error?: string
  success: boolean
}

export const auth = {
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, user: data.user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  async signOut(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  async getSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session
    } catch (error) {
      console.error('Error getting session:', error)
      return null
    }
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null)
    })
  },
}
