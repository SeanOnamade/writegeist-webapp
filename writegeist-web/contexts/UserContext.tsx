'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { auth } from '@/lib/supabase/auth'
import { api } from '@/lib/api/client'
import type { User } from '@supabase/supabase-js'
import type { User as DBUser } from '@/types/database'

interface UserContextType {
  user: User | null
  profile: DBUser | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<DBUser>) => Promise<boolean>
  refreshProfile: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<DBUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get initial user
    auth.getCurrentUser().then((currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        loadProfile()
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange((authUser) => {
      setUser(authUser)
      if (authUser) {
        loadProfile()
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async () => {
    try {
      setError(null)
      const result = await api.getCurrentUser()
      
      if (result.success && result.data) {
        setProfile(result.data)
      } else if (result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    await loadProfile()
  }

  const updateProfile = async (updates: Partial<DBUser>): Promise<boolean> => {
    try {
      setError(null)
      const result = await api.updateUserProfile(updates)
      
      if (result.success && result.data) {
        setProfile(result.data)
        return true
      } else {
        setError(result.error || 'Failed to update profile')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setError(errorMessage)
      console.error('Error updating profile:', err)
      return false
    }
  }

  const signOut = async () => {
    try {
      setError(null)
      await auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out')
      console.error('Error signing out:', err)
    }
  }

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    signOut,
    updateProfile,
    refreshProfile
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Hook for checking authentication status
export function useAuth() {
  const { user, loading } = useUser()
  
  return {
    isAuthenticated: !!user,
    isLoading: loading,
    user
  }
}

