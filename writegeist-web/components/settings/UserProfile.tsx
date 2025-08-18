'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'
import type { User } from '@/types/database'

export function UserProfile() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const result = await api.getCurrentUser()
      if (result.success && result.data) {
        setUser(result.data)
        setFullName(result.data.full_name || '')
      }
    } catch (error) {
      console.error('Error loading user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    setMessage('')

    try {
      let avatarUrl = user.avatar_url

      // Upload avatar if selected
      if (avatarFile) {
        const uploadResult = await api.uploadFile(
          avatarFile, 
          'user-avatars', 
          `avatar_${Date.now()}.${avatarFile.name.split('.').pop()}`
        )
        
        if (uploadResult.success && uploadResult.data) {
          const urlResult = await api.getFileUrl('user-avatars', uploadResult.data)
          if (urlResult.success) {
            avatarUrl = urlResult.data || null
          }
        }
      }

      // Update user profile
      const result = await api.updateUserProfile({
        full_name: fullName || null,
        avatar_url: avatarUrl
      })

      if (result.success) {
        setMessage('Profile updated successfully!')
        setUser(result.data || user)
        setAvatarFile(null)
      } else {
        setMessage('Failed to update profile: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      setMessage('Error updating profile: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded w-1/3"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
        <div className="h-10 bg-muted animate-pulse rounded"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Unable to load user profile</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile Information</h3>
        <p className="text-sm text-muted-foreground">
          Update your personal information and profile picture.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Email cannot be changed. Contact support if needed.
          </p>
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium mb-2">
            Full Name
          </label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label htmlFor="avatar" className="block text-sm font-medium mb-2">
            Profile Picture
          </label>
          <div className="flex items-center space-x-4">
            {user.avatar_url && (
              <img
                src={user.avatar_url}
                alt="Current avatar"
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <Input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a new profile picture (max 2MB, JPG/PNG/WebP)
          </p>
        </div>

        {message && (
          <div className={`p-3 rounded-md text-sm ${
            message.includes('successfully') 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}

