import { app } from 'electron'
import { readFile, writeFile, mkdir, access, unlink, stat, constants } from 'fs/promises'
import * as path from 'path'
import { settingsLogger } from '../utils/logger'
import type { DirectorySettings, Directory, AppSettings } from '../../shared/types'

export type { DirectorySettings, Directory, AppSettings }

class SettingsService {
  private settingsPath: string
  private settingsDir: string
  private settings: AppSettings | undefined = undefined
  private settingsFileExists = false

  constructor() {
    // Get user's Documents folder
    const documentsPath = app.getPath('documents')
    this.settingsDir = path.join(documentsPath, 'Panopticon')
    this.settingsPath = path.join(this.settingsDir, 'settings.json')
  }

  /**
   * Initialize the settings service - load settings if they exist
   */
  async init(): Promise<void> {
    try {
      // Check if settings file exists
      await access(this.settingsPath, constants.F_OK)
      this.settingsFileExists = true

      // Load settings
      const data = await readFile(this.settingsPath, 'utf-8')
      this.settings = JSON.parse(data)
      settingsLogger.info('Settings loaded successfully from:', this.settingsPath)
    } catch {
      // Settings file doesn't exist - this is fine on first run
      settingsLogger.info('No existing settings file found at:', this.settingsPath)
      this.settingsFileExists = false
      this.settings = {
        collections: {},
        directories: {}
      }
    }
  }

  /**
   * Get whether the settings file exists
   */
  getSettingsFileExists(): boolean {
    return this.settingsFileExists
  }

  /**
   * Get the full path to the settings file
   */
  getSettingsPath(): string {
    return this.settingsPath
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return this.settings || { collections: {}, directories: {} }
  }

  /**
   * Get all directories
   */
  getDirectories(): Record<string, Directory> {
    return this.settings?.directories || {}
  }

  /**
   * Get a specific directory by ID
   */
  getDirectory(id: string): Directory | null {
    return this.settings?.directories[id] || null
  }

  /**
   * Add or update a directory
   */
  async addDirectory(id: string, directory: Directory): Promise<void> {
    if (!this.settings) {
      this.settings = { collections: {}, directories: {}, offlineMode: false }
    }

    this.settings.directories[id] = directory
    await this.saveSettings()
  }

  /**
   * Remove a directory
   */
  async removeDirectory(id: string): Promise<void> {
    if (!this.settings?.directories) {
      return
    }

    delete this.settings.directories[id]
    await this.saveSettings()
  }

  /**
   * Update directory settings
   */
  async updateDirectorySettings(id: string, settings: Partial<DirectorySettings>): Promise<void> {
    const directory = this.settings?.directories[id]
    if (!directory) {
      throw new Error(`Directory with id ${id} not found`)
    }

    directory.settings = {
      ...directory.settings,
      ...settings
    }

    await this.saveSettings()
  }

  /**
   * Update directory last accessed time
   */
  async updateDirectoryLastAccessed(id: string): Promise<void> {
    const directory = this.settings?.directories[id]
    if (!directory) {
      throw new Error(`Directory with id ${id} not found`)
    }

    directory.lastAccessed = new Date().toISOString()
    await this.saveSettings()
  }

  /**
   * Update directory exists status
   */
  async updateDirectoryExists(id: string, exists: boolean): Promise<void> {
    const directory = this.settings?.directories[id]
    if (!directory) {
      throw new Error(`Directory with id ${id} not found`)
    }

    directory.exists = exists
    await this.saveSettings()
  }

  /**
   * Update all directoryt exists status
   */
  async updateAllDirectoryExists(): Promise<void> {
    if (!this.settings?.directories) {
      return
    }

    await Promise.all(
      Object.entries(this.settings.directories).map(async ([, dir]) => {
        const exists = await stat(dir.path)
          .then(() => true)
          .catch(() => false)
        dir.exists = exists
      })
    )

    await this.saveSettings()
  }

  /**
   * Create default settings file
   */
  async createDefaultSettings(offlineMode: boolean = true): Promise<void> {
    const now = new Date()
    const iso = now.toISOString()
    const initTime = iso.slice(0, 10).replace(/-/g, '') + '-' + iso.slice(11, 19).replace(/:/g, '')

    // Get system type
    const systemType =
      process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux'

    // Initialize settings with metadata
    this.settings = {
      initTime,
      systemType,
      offlineMode, // Use the parameter value
      collections: {},
      directories: {}
    }

    // Save to disk (this will create the folder and file)
    await this.saveSettings()

    settingsLogger.info('Default settings created at:', this.settingsPath)
  }

  /**
   * Save settings to file
   */
  private async saveSettings(): Promise<void> {
    try {
      // Ensure the Panopticon directory exists
      try {
        await mkdir(this.settingsDir, { recursive: true })
      } catch {
        // Directory might already exist, that's fine
      }

      // Write settings to file
      await writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
      this.settingsFileExists = true
      settingsLogger.info('Settings saved successfully to:', this.settingsPath)
    } catch (error) {
      settingsLogger.error('Error saving settings:', error)
      throw error
    }
  }

  /**
   * Update offline mode setting
   */
  async updateOfflineMode(offlineMode: boolean): Promise<void> {
    if (!this.settings) {
      settingsLogger.warn('updateOfflineMode called before settings are initialized')
      return
    }
    this.settings.offlineMode = offlineMode
    await this.saveSettings()
    settingsLogger.info(`Offline mode updated to: ${offlineMode}`)
  }

  /**
   * Reset settings (delete the file)
   */
  async reset(): Promise<void> {
    try {
      if (this.settingsFileExists) {
        await unlink(this.settingsPath)
        this.settingsFileExists = false
      }
      this.settings = { collections: {}, directories: {}, offlineMode: false }
      settingsLogger.info('Settings reset successfully')
    } catch (error) {
      settingsLogger.error('Error resetting settings:', error)
      throw error
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService()
