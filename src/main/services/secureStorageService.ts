import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const access = promisify(fs.access)

/**
 * Service for securely storing sensitive data like API keys
 * Uses Electron's safeStorage API which leverages OS-native encryption:
 * - Windows: Data Protection API (DPAPI)
 * - macOS: Keychain Services
 * - Linux: libsecret (Secret Service API)
 */
class SecureStorageService {
  private storageDir: string
  private storageFile: string

  constructor() {
    // Store encrypted data in user data directory
    this.storageDir = app.getPath('userData')
    this.storageFile = path.join(this.storageDir, 'secure-storage.dat')
  }

  /**
   * Check if safeStorage is available on this platform
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  /**
   * Store an encrypted value
   */
  async setItem(key: string, value: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Encryption is not available on this system')
    }

    try {
      // Load existing storage or create new
      const storage = await this.loadStorage()

      // Encrypt the value
      const buffer = safeStorage.encryptString(value)
      const encrypted = buffer.toString('base64')

      // Store the encrypted value
      storage[key] = encrypted

      // Save to disk
      await writeFile(this.storageFile, JSON.stringify(storage), 'utf-8')
    } catch (error) {
      console.error('Error storing secure item:', error)
      throw new Error(`Failed to store secure item: ${(error as Error).message}`)
    }
  }

  /**
   * Retrieve and decrypt a value
   */
  async getItem(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      throw new Error('Encryption is not available on this system')
    }

    try {
      const storage = await this.loadStorage()

      if (!storage[key]) {
        return null
      }

      // Decrypt the value
      const buffer = Buffer.from(storage[key], 'base64')
      const decrypted = safeStorage.decryptString(buffer)

      return decrypted
    } catch (error) {
      console.error('Error retrieving secure item:', error)
      throw new Error(`Failed to retrieve secure item: ${(error as Error).message}`)
    }
  }

  /**
   * Remove a stored value
   */
  async removeItem(key: string): Promise<void> {
    try {
      const storage = await this.loadStorage()

      if (storage[key]) {
        delete storage[key]
        await writeFile(this.storageFile, JSON.stringify(storage), 'utf-8')
      }
    } catch (error) {
      console.error('Error removing secure item:', error)
      throw new Error(`Failed to remove secure item: ${(error as Error).message}`)
    }
  }

  /**
   * Check if a key exists
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const storage = await this.loadStorage()
      return key in storage
    } catch (error) {
      return false
    }
  }

  /**
   * Clear all stored values
   */
  async clear(): Promise<void> {
    try {
      await unlink(this.storageFile)
    } catch (error) {
      // File doesn't exist, that's fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  /**
   * Load the storage file
   */
  private async loadStorage(): Promise<Record<string, string>> {
    try {
      await access(this.storageFile, fs.constants.F_OK)
      const content = await readFile(this.storageFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      // File doesn't exist, return empty storage
      return {}
    }
  }
}

export const secureStorageService = new SecureStorageService()
