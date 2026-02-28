import * as fs from 'fs'
import * as path from 'path'
import chokidar, { type FSWatcher } from 'chokidar'
import { settingsService } from './settingsService'
import { watcherLogger } from '../utils/logger'

/**
 * Service to watch directories for changes and trigger re-indexing
 */
class DirectoryWatcherService {
  private watchers: Map<string, FSWatcher> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private onIndexCallback?: (
    directoryId: string,
    directoryPath: string,
    fileTypes: string[]
  ) => Promise<void>

  /**
   * Set the callback function to call when a directory needs re-indexing
   */
  setIndexCallback(
    callback: (directoryId: string, directoryPath: string, fileTypes: string[]) => Promise<void>
  ) {
    this.onIndexCallback = callback
  }

  /**
   * Start watching a directory for changes
   */
  watchDirectory(directoryId: string, directoryPath: string, fileTypes: string[]) {
    // Don't watch if already watching
    if (this.watchers.has(directoryId)) {
      return
    }

    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      watcherLogger.warn(`Cannot watch missing directory: ${directoryPath}`)
      return
    }

    try {
      // Create chokidar watcher
      const watcher = chokidar.watch(directoryPath, {
        persistent: true,
        ignoreInitial: true, // Don't trigger events for existing files on startup
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.svn/**',
          '**/.hg/**',
          '**/Thumbs.db',
          '**/.DS_Store'
        ],
        depth: 99, // Watch subdirectories recursively
        awaitWriteFinish: {
          stabilityThreshold: 500, // Wait for file writes to finish
          pollInterval: 100
        }
      })

      // Handle all file system events
      watcher.on('all', (event, filePath) => {
        watcherLogger.debug(`Event detected: ${event} - ${filePath}`)
        const ext = path.extname(filePath).toLowerCase().slice(1)

        // Only trigger on relevant file types and relevant events
        if (
          (fileTypes.includes(ext) || fileTypes.includes(ext.toLowerCase())) &&
          (event === 'add' || event === 'change' || event === 'unlink')
        ) {
          const relativePath = path.relative(directoryPath, filePath)
          this.handleChange(directoryId, directoryPath, fileTypes, event, relativePath)
        } else {
          watcherLogger.debug(
            `Ignoring event - ext: ${ext}, event: ${event}, fileTypes: ${fileTypes.join(', ')}`
          )
        }
      })

      // Handle errors
      watcher.on('error', (error) => {
        watcherLogger.error(`Error watching ${directoryPath}:`, error)
      })

      // Handle ready event
      watcher.on('ready', () => {
        watcherLogger.info(`Ready to watch: ${directoryPath}`)
      })

      this.watchers.set(directoryId, watcher)
      watcherLogger.info(
        `Started watching: ${directoryPath} for file types: ${fileTypes.join(', ')}`
      )
    } catch (error) {
      watcherLogger.error(`Failed to watch ${directoryPath}:`, error)
    }
  }

  /**
   * Stop watching a directory
   */
  async unwatchDirectory(directoryId: string) {
    const watcher = this.watchers.get(directoryId)
    if (watcher) {
      await watcher.close()
      this.watchers.delete(directoryId)
      watcherLogger.info(`Stopped watching directory: ${directoryId}`)
    }

    // Clear any pending debounce timers
    const timer = this.debounceTimers.get(directoryId)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(directoryId)
    }
  }

  /**
   * Handle file system change event with debouncing
   */
  private handleChange(
    directoryId: string,
    directoryPath: string,
    fileTypes: string[],
    eventType: string,
    filename: string
  ) {
    watcherLogger.debug(`Change detected in ${directoryId}: ${eventType} - ${filename}`)

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(directoryId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new debounced timer (wait 2 seconds after last change)
    const timer = setTimeout(async () => {
      watcherLogger.info(`Triggering re-index for: ${directoryPath}`)
      if (this.onIndexCallback) {
        try {
          await this.onIndexCallback(directoryId, directoryPath, fileTypes)
        } catch (error) {
          watcherLogger.error(`Re-index failed:`, error)
        }
      }
      this.debounceTimers.delete(directoryId)
    }, 2000) // 2 second debounce

    this.debounceTimers.set(directoryId, timer)
  }

  /**
   * Initialize watchers for all directories with watchForChanges enabled
   */
  async initializeWatchers() {
    const directories = settingsService.getDirectories()
    watcherLogger.info(
      `Initializing watchers for ${Object.keys(directories).length} directories...`
    )

    for (const [id, dir] of Object.entries(directories)) {
      watcherLogger.debug(
        `Directory ${id}: exists=${dir.exists}, watchForChanges=${dir.settings.watchForChanges}`
      )
      if (dir.exists && dir.settings.watchForChanges) {
        const fileTypes = dir.settings.fileTypes || ['pdf', 'markdown', 'md']
        this.watchDirectory(id, dir.path, fileTypes)
      }
    }

    watcherLogger.info(`Initialized ${this.watchers.size} directory watchers`)
  }

  /**
   * Stop all watchers
   */
  async stopAllWatchers() {
    const ids = Array.from(this.watchers.keys())
    await Promise.all(ids.map((id) => this.unwatchDirectory(id)))
    watcherLogger.info('Stopped all directory watchers')
  }

  /**
   * Get list of currently watched directory IDs
   */
  getWatchedDirectories(): string[] {
    return Array.from(this.watchers.keys())
  }
}

// Export singleton instance
export const directoryWatcherService = new DirectoryWatcherService()
