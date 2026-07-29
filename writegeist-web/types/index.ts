// Shared non-database types. Database row types live in types/database.ts.

export interface APIResponse<T = unknown> {
  data?: T
  error?: string
  success: boolean
}
