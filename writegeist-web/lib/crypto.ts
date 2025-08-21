import CryptoJS from 'crypto-js'

// Use environment variable for encryption key
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'writegeist-default-key-change-in-production'

// Warn if using default key in production
if (process.env.NODE_ENV === 'production' && ENCRYPTION_KEY === 'writegeist-default-key-change-in-production') {
  console.warn('🚨 SECURITY WARNING: Using default encryption key in production! Set ENCRYPTION_KEY environment variable.')
}

/**
 * Encrypt sensitive data like API keys before storing in database
 */
export function encryptData(plaintext: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString()
    return encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data like API keys when reading from database
 */
export function decryptData(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    
    if (!decrypted) {
      throw new Error('Failed to decrypt - invalid data or key')
    }
    
    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Check if a string appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  // Simple heuristic: encrypted data is base64-like and doesn't start with 'sk-'
  return !data.startsWith('sk-') && data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(data)
}

/**
 * Safely get API key - handles both encrypted and plain text (for migration)
 */
export function getApiKey(stored: string): string {
  if (!stored) return ''
  
  try {
    if (isEncrypted(stored)) {
      return decryptData(stored)
    } else {
      // Plain text - return as-is (for backward compatibility)
      return stored
    }
  } catch (error) {
    console.error('Error processing API key:', error)
    return ''
  }
}
