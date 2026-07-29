import CryptoJS from 'crypto-js'

// Server-only module. ENCRYPTION_KEY is intentionally not NEXT_PUBLIC_*:
// keys are encrypted/decrypted exclusively in API routes.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

// Key that shipped hardcoded in old builds. Kept for decrypt-only migration of
// values stored before server-side encryption was enforced; anything it
// decrypts gets re-encrypted with the real key on the next save.
const LEGACY_KEY = 'writegeist-default-key-change-in-production'

/**
 * Encrypt sensitive data like API keys before storing in the database.
 * Throws when ENCRYPTION_KEY is not configured — never silently falls back
 * to a publicly known key.
 */
export function encryptData(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString()
}

function tryDecrypt(ciphertext: string, key: string): string | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8)
    return decrypted || null
  } catch {
    return null
  }
}

/**
 * Check if a string appears to be encrypted.
 */
export function isEncrypted(data: string): boolean {
  // Simple heuristic: encrypted data is base64-like and doesn't start with 'sk-'
  return !data.startsWith('sk-') && data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(data)
}

/**
 * Safely get an API key from its stored representation — handles encrypted
 * values, legacy-key encrypted values, and plaintext (pre-encryption) values.
 */
export function getApiKey(stored: string): string {
  if (!stored) return ''
  if (!isEncrypted(stored)) return stored

  if (ENCRYPTION_KEY) {
    const decrypted = tryDecrypt(stored, ENCRYPTION_KEY)
    if (decrypted) return decrypted
  }

  return tryDecrypt(stored, LEGACY_KEY) ?? ''
}
