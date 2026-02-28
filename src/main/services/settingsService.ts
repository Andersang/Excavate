import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)
const access = promisify(fs.access)

export interface DirectorySettings {
  watchForChanges: boolean
  excludePatterns: string[]
  fileTypes: string[]
}

export interface Directory {
  path: string
  name: string
  addedAt: string
  exists: boolean
  settings: DirectorySettings
  lastAccessed: string
}

export interface AppSettings {
  initTime?: string
  systemType?: string
  offlineMode?: boolean
  collections?: Record<string, any>
  directories: Record<string, Directory>
}

class SettingsService {
  private settingsPath: string
  private settingsDir: string
  private settings: AppSettings | null = null
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
      await access(this.settingsPath, fs.constants.F_OK)
      this.settingsFileExists = true

      // Load settings
      const data = await readFile(this.settingsPath, 'utf-8')
      this.settings = JSON.parse(data)
      console.log('Settings loaded successfully from:', this.settingsPath)
    } catch (error) {
      // Settings file doesn't exist - this is fine on first run
      console.log('No existing settings file found at:', this.settingsPath)
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
      this.settings = { directories: {} }
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
      Object.entries(this.settings.directories).map(async ([_id, dir]) => {
        const exists = await fs.promises
          .stat(dir.path)
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
    // Get current date/time in YYYYMMDD-HHMMSS format
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const initTime = `${year}${month}${day}-${hours}${minutes}${seconds}`

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

    console.log('Default settings created at:', this.settingsPath)
  }

  /**
   * Save settings to file
   */
  private async saveSettings(): Promise<void> {
    try {
      // Ensure the Panopticon directory exists
      try {
        await mkdir(this.settingsDir, { recursive: true })
      } catch (error) {
        // Directory might already exist, that's fine
      }

      // Write settings to file
      await writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
      this.settingsFileExists = true
      console.log('Settings saved successfully to:', this.settingsPath)
    } catch (error) {
      console.error('Error saving settings:', error)
      throw error
    }
  }

  /**
   * Update offline mode setting
   */
  async updateOfflineMode(offlineMode: boolean): Promise<void> {
    await this.init() // Reload settings from disk
    if (this.settings) {
      this.settings.offlineMode = offlineMode
      await this.saveSettings()
      console.log(`Offline mode updated to: ${offlineMode}`)
    }
  }

  /**
   * Reset settings (delete the file)
   */
  async reset(): Promise<void> {
    try {
      if (this.settingsFileExists) {
        await promisify(fs.unlink)(this.settingsPath)
        this.settingsFileExists = false
      }
      this.settings = { directories: {} }
      console.log('Settings reset successfully')
    } catch (error) {
      console.error('Error resetting settings:', error)
      throw error
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService()
