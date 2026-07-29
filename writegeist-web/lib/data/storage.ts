import type { DbClient } from './types'

export interface StorageUsage {
  byBucket: Record<string, { count: number; size: number }>
  total: { count: number; size: number }
}

const BUCKETS = ['audio-files', 'documents', 'user-avatars', 'chapter-content']

export async function getStorageUsage(db: DbClient): Promise<StorageUsage | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const results = await Promise.all(
    BUCKETS.map(async (bucket) => {
      try {
        const { data: files, error } = await db.storage.from(bucket).list(user.id, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        })

        if (error || !files) return { bucket, count: 0, size: 0 }

        const size = files.reduce((acc, file) => acc + (file.metadata?.size || 0), 0)
        return { bucket, count: files.length, size }
      } catch {
        return { bucket, count: 0, size: 0 }
      }
    })
  )

  const byBucket: StorageUsage['byBucket'] = {}
  let totalCount = 0
  let totalSize = 0
  for (const { bucket, count, size } of results) {
    byBucket[bucket] = { count, size }
    totalCount += count
    totalSize += size
  }

  return { byBucket, total: { count: totalCount, size: totalSize } }
}
