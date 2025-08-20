'use client'

import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api/client'

interface StorageData {
  byBucket: Record<string, { count: number; size: number }>
  total: { count: number; size: number }
}

const BUCKET_LABELS = {
  'audio-files': 'Audio Files',
  'documents': 'Documents',  
  'user-avatars': 'Profile Pictures',
  'chapter-content': 'Chapter Content'
} as const

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function StorageUsage() {
  const [storageData, setStorageData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStorageUsage = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await api.getStorageUsage()
      if (result.success && result.data) {
        setStorageData(result.data)
      } else {
        setError(result.error || 'Failed to load storage usage')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStorageUsage()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded w-1/3"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-4 bg-muted animate-pulse rounded w-1/4"></div>
              <div className="h-4 bg-muted animate-pulse rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg border-red-200 bg-red-50">
        <h4 className="font-medium text-red-800 mb-2">Storage Usage Unavailable</h4>
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={loadStorageUsage}>
          Retry
        </Button>
      </div>
    )
  }

  if (!storageData) {
    return null
  }

  // Calculate storage limit (you can adjust this based on your plan)
  const STORAGE_LIMIT = 1024 * 1024 * 1024 // 1GB in bytes
  const usagePercentage = Math.min((storageData.total.size / STORAGE_LIMIT) * 100, 100)

  return (
    <div className="space-y-6">
      <div>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Total Storage Used</span>
            <span className="font-medium">
              {formatBytes(storageData.total.size)} of {formatBytes(STORAGE_LIMIT)}
            </span>
          </div>
          
          <Progress value={usagePercentage} className="h-2" />
          
          <div className="text-xs text-muted-foreground">
            {storageData.total.count} files • {usagePercentage.toFixed(1)}% used
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h5 className="text-sm font-medium">Storage by Type</h5>
        
        {Object.entries(storageData.byBucket).map(([bucket, data]) => {
          const percentage = storageData.total.size > 0 
            ? (data.size / storageData.total.size) * 100 
            : 0
          
          return (
            <div key={bucket} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">
                    {BUCKET_LABELS[bucket as keyof typeof BUCKET_LABELS]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(data.size)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{data.count} files</span>
                  {percentage > 0 && <span>{percentage.toFixed(1)}% of total</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadStorageUsage}>
          Refresh Usage
        </Button>
      </div>
    </div>
  )
}
