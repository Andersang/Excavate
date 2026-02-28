import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { directoryWatcherService } from '../services/directoryWatcherService'

// Default exclusion patterns
const DEFAULT_EXCLUSION_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.svn/**',
  '.hg/**',
  'Thumbs.db',
  '.DS_Store'
]

interface FileInfo {
  id: string
  name: string
  path: string
  size: number
  mtime: string
  extension: string
  exists: boolean
  tags?: string[]
}

interface DirectoryConfig {
  createdAt: string
  updatedAt: string
  fileTypes: string[]
  fileCount: number
  fileIndex: FileInfo[]
  customExclusionPatterns: string[]
  allTags?: string[]
}

/**
 * Check if a file path should be excluded based on patterns
 */
function shouldExclude(filePath: string, rootPath: string, exclusionPatterns: string[]): boolean {
  const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/')

  for (const pattern of exclusionPatterns) {
    if (pattern.endsWith('/**')) {
      // Directory pattern
      const dirPattern = pattern.slice(0, -3)
      if (relativePath.startsWith(dirPattern + '/') || relativePath === dirPattern) {
        return true
      }
    } else {
      // File pattern
      if (relativePath === pattern || path.basename(filePath) === pattern) {
        return true
      }
    }
  }

  return false
}

/**
 * Get file extension without the dot
 */
function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1)
}

/**
 * Convert relative file paths to absolute paths for a given directory
 */
function resolveFilePaths(files: FileInfo[], directoryPath: string): FileInfo[] {
  return files.map((file) => ({
    ...file,
    path: path.isAbsolute(file.path) ? file.path : path.join(directoryPath, file.path)
  }))
}

/**
 * Sanitize a tag by removing leading/trailing whitespace and rejecting invalid tags
 * Returns null if tag is invalid
 */
function sanitizeTag(tag: string): string | null {
  // Trim whitespace
  const trimmed = tag.trim()
  
  // Reject empty tags
  if (trimmed.length === 0) {
    return null
  }
  
  // Reject tags containing hash symbols
  if (trimmed.includes('#')) {
    return null
  }
  
  return trimmed
}

/**
 * Sanitize an array of tags, removing invalid ones
 */
function sanitizeTags(tags: string[]): string[] {
  const sanitized: string[] = []
  const seen = new Set<string>()
  
  for (const tag of tags) {
    const clean = sanitizeTag(tag)
    if (clean && !seen.has(clean)) {
      sanitized.push(clean)
      seen.add(clean)
    }
  }
  
  return sanitized
}

/**
 * Recursively scan directory for files matching the specified types
 */
async function scanDirectory(
  dirPath: string,
  fileTypes: string[],
  exclusionPatterns: string[]
): Promise<FileInfo[]> {
  const files: FileInfo[] = []

  async function scanRecursive(currentPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        // Check if this path should be excluded
        if (shouldExclude(fullPath, dirPath, exclusionPatterns)) {
          continue
        }

        if (entry.isDirectory()) {
          await scanRecursive(fullPath)
        } else if (entry.isFile()) {
          const extension = getFileExtension(entry.name)

          // Check if this file type should be indexed
          if (fileTypes.includes(extension)) {
            try {
              const stats = await fs.promises.stat(fullPath)
              // Store relative path to make directory portable
              const relativePath = path.relative(dirPath, fullPath)
              files.push({
                id: crypto.randomUUID(),
                name: entry.name,
                path: relativePath,
                size: stats.size,
                mtime: stats.mtime.toISOString(),
                extension: extension,
                exists: true
              })
            } catch (error) {
              // Skip files we can't stat
              console.warn('Could not stat file:', fullPath, error)
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn('Could not read directory:', currentPath, error)
    }
  }

  await scanRecursive(dirPath)
  return files
}

/**
 * Incrementally update file index by checking mtimes
 * Returns updated file list with added/modified/removed files
 */
async function incrementalScanDirectory(
  dirPath: string,
  existingIndex: FileInfo[],
  fileTypes: string[],
  exclusionPatterns: string[]
): Promise<{ files: FileInfo[]; added: number; modified: number; removed: number }> {
  // Create a map of existing files by path for quick lookup
  const existingFiles = new Map<string, FileInfo>()
  for (const file of existingIndex) {
    existingFiles.set(file.path, file)
  }

  const currentFiles: FileInfo[] = []
  const seenPaths = new Set<string>()
  let added = 0
  let modified = 0

  async function scanRecursive(currentPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (shouldExclude(fullPath, dirPath, exclusionPatterns)) {
          continue
        }

        if (entry.isDirectory()) {
          await scanRecursive(fullPath)
        } else if (entry.isFile()) {
          const extension = getFileExtension(entry.name)

          if (fileTypes.includes(extension)) {
            try {
              const stats = await fs.promises.stat(fullPath)
              // Store relative path to make directory portable
              const relativePath = path.relative(dirPath, fullPath)

              seenPaths.add(relativePath)

              const existingFile = existingFiles.get(relativePath)

              // Preserve existing ID or generate new one, ensure ID exists
              const fileId = existingFile?.id || crypto.randomUUID()

              const newFile: FileInfo = {
                id: fileId,
                name: entry.name,
                path: relativePath,
                size: stats.size,
                mtime: stats.mtime.toISOString(),
                extension: extension,
                exists: true
              }

              if (!existingFile) {
                // New file
                added++
                currentFiles.push(newFile)
              } else if (
                existingFile.mtime !== newFile.mtime ||
                existingFile.size !== newFile.size
              ) {
                // Modified file - preserve ID
                modified++
                currentFiles.push(newFile)
              } else {
                // Unchanged file - reuse existing entry but ensure exists is true and ID exists
                currentFiles.push({
                  ...existingFile,
                  id: fileId, // Ensure ID exists even for old entries
                  exists: true
                })
              }
            } catch (error) {
              console.warn('Could not stat file:', fullPath, error)
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not read directory:', currentPath, error)
    }
  }

  await scanRecursive(dirPath)

  // Mark missing files (existed before but not found now)
  let removed = 0
  for (const existingFile of existingIndex) {
    if (!seenPaths.has(existingFile.path)) {
      removed++
      // Mark file as missing instead of removing it
      currentFiles.push({
        ...existingFile,
        exists: false
      })
    }
  }

  return { files: currentFiles, added, modified, removed }
}

/**
 * Index a directory (used internally and by watcher)
 */
async function indexDirectoryInternal(directoryPath: string, fileTypes: string[]) {
  const configPath = path.join(directoryPath, 'panopticon.directory.json')

  let config: DirectoryConfig
  let fileIndex: FileInfo[]
  let isFirstScan = false
  let changeStats = { added: 0, modified: 0, removed: 0 }

  const allExclusionPatterns = [...DEFAULT_EXCLUSION_PATTERNS]

  if (!fs.existsSync(configPath)) {
    isFirstScan = true
    const now = new Date().toISOString()
    config = {
      createdAt: now,
      updatedAt: now,
      fileTypes: fileTypes,
      fileCount: 0,
      fileIndex: [],
      customExclusionPatterns: []
    }

    fileIndex = await scanDirectory(directoryPath, config.fileTypes, allExclusionPatterns)
    changeStats.added = fileIndex.length
  } else {
    const content = fs.readFileSync(configPath, 'utf-8')
    config = JSON.parse(content)

    allExclusionPatterns.push(...config.customExclusionPatterns)
    
    // Use the passed fileTypes parameter instead of the one from config
    // This ensures we use the latest settings from the directory object
    const scanResult = await incrementalScanDirectory(
      directoryPath,
      config.fileIndex,
      fileTypes, // Use parameter instead of config.fileTypes
      allExclusionPatterns
    )

    fileIndex = scanResult.files
    changeStats = {
      added: scanResult.added,
      modified: scanResult.modified,
      removed: scanResult.removed
    }
  }

  config.fileIndex = fileIndex
  config.fileTypes = fileTypes // Update fileTypes to match the parameter
  // Count only existing files
  const existingFileCount = fileIndex.filter((f) => f.exists).length
  config.fileCount = existingFileCount
  config.updatedAt = new Date().toISOString()

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

  return {
    success: true,
    fileCount: existingFileCount,
    fileIndex: fileIndex,
    isFirstScan: isFirstScan,
    changes: changeStats
  }
}

/**
 * Register directory-related IPC handlers
 */
export function registerDirectoryHandlers(): void {
  // Set up auto-index callback for watcher service
  directoryWatcherService.setIndexCallback(async (directoryId, directoryPath, fileTypes) => {
    try {
      const result = await indexDirectoryInternal(directoryPath, fileTypes)
      console.log(`[Watcher] Auto-indexed ${directoryId}: ${result.fileCount} files`)

      // Notify all windows that directory was updated
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('directory:updated', { directoryId, fileCount: result.fileCount })
      })
    } catch (error) {
      console.error(`[Watcher] Failed to auto-index ${directoryId}:`, error)
    }
  })

  ipcMain.handle('dialog:open-directory', async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  ipcMain.handle(
    'directory:create-config',
    async (_event, directoryPath: string, fileTypes: string[]) => {
      const configPath = path.join(directoryPath, 'panopticon.directory.json')

      // Check if config already exists
      if (fs.existsSync(configPath)) {
        return { success: false, error: 'Configuration file already exists in this directory' }
      }

      const now = new Date().toISOString()
      const config = {
        createdAt: now,
        updatedAt: now,
        fileTypes: fileTypes,
        fileCount: 0,
        fileIndex: [],
        customExclusionPatterns: []
      }

      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
        return { success: true, path: configPath }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('directory:read-config', async (_event, directoryPath: string) => {
    const configPath = path.join(directoryPath, 'panopticon.directory.json')

    try {
      if (!fs.existsSync(configPath)) {
        // Create default config if it doesn't exist
        const defaultConfig: DirectoryConfig = {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fileTypes: [],
          fileCount: 0,
          fileIndex: [],
          customExclusionPatterns: [],
          allTags: []
        }

        // Create the config file
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
        console.log('[Directory] Created default config for:', directoryPath)

        return { success: true, config: defaultConfig }
      }

      const content = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content)
      
      // Convert relative paths to absolute for renderer
      if (config.fileIndex) {
        config.fileIndex = resolveFilePaths(config.fileIndex, directoryPath)
      }
      
      return { success: true, config }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

    ipcMain.handle('directory:index', async (_event, directoryPath: string, fileTypes: string[]) => {
    try {
      const result = await indexDirectoryInternal(directoryPath, fileTypes)
      // Convert relative paths to absolute for renderer
      if (result.fileIndex) {
        result.fileIndex = resolveFilePaths(result.fileIndex, directoryPath)
      }
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('directory:index-all', async (_event, directories: Record<string, any>) => {
    const results: Record<string, any> = {}

    for (const [id, directory] of Object.entries(directories)) {
      if (!directory.exists) {
        results[id] = { success: false, error: 'Directory does not exist' }
        continue
      }

      try {
        // Directly call the indexing logic instead of emitting IPC
        const configPath = path.join(directory.path, 'panopticon.directory.json')
        const fileTypes = directory.settings?.fileTypes || ['pdf', 'markdown', 'md']

        let config: DirectoryConfig

        // Read existing config or create new one
        if (!fs.existsSync(configPath)) {
          const now = new Date().toISOString()
          config = {
            createdAt: now,
            updatedAt: now,
            fileTypes: fileTypes,
            fileCount: 0,
            fileIndex: [],
            customExclusionPatterns: []
          }
        } else {
          const content = fs.readFileSync(configPath, 'utf-8')
          config = JSON.parse(content)
        }

        const allExclusionPatterns = [
          ...DEFAULT_EXCLUSION_PATTERNS,
          ...config.customExclusionPatterns
        ]
        const fileIndex = await scanDirectory(
          directory.path,
          config.fileTypes,
          allExclusionPatterns
        )

        config.fileIndex = fileIndex
        config.fileCount = fileIndex.length
        config.updatedAt = new Date().toISOString()

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

        // Convert relative paths to absolute for renderer
        const resolvedFileIndex = resolveFilePaths(fileIndex, directory.path)

        results[id] = {
          success: true,
          fileCount: fileIndex.length,
          fileIndex: resolvedFileIndex
        }
      } catch (error) {
        results[id] = { success: false, error: (error as Error).message }
      }
    }

    return results
  })

  // Watcher control handlers
  ipcMain.handle(
    'directory:start-watch',
    async (_event, directoryId: string, directoryPath: string, fileTypes: string[]) => {
      try {
        directoryWatcherService.watchDirectory(directoryId, directoryPath, fileTypes)
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('directory:stop-watch', async (_event, directoryId: string) => {
    try {
      await directoryWatcherService.unwatchDirectory(directoryId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('directory:init-watchers', async () => {
    try {
      await directoryWatcherService.initializeWatchers()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'directory:delete-files',
    async (_event, directoryPath: string, filePaths: string[]) => {
      try {
        const configPath = path.join(directoryPath, 'panopticon.directory.json')

        if (!fs.existsSync(configPath)) {
          return { success: false, error: 'Configuration file not found' }
        }

        // Read config
        const content = fs.readFileSync(configPath, 'utf-8')
        const config: DirectoryConfig = JSON.parse(content)

        // Delete physical files and remove from index
        let deletedCount = 0
        const failedFiles: string[] = []

        // Convert absolute paths from renderer to relative paths for comparison
        const relativePathsToDelete = filePaths.map((absolutePath) =>
          path.relative(directoryPath, absolutePath)
        )

        for (const filePath of filePaths) {
          try {
            // Delete physical file if it exists (filePath is absolute from renderer)
            if (fs.existsSync(filePath)) {
              await fs.promises.unlink(filePath)
            }
            deletedCount++
          } catch (error) {
            console.error(`Failed to delete file: ${filePath}`, error)
            failedFiles.push(filePath)
          }
        }

        // Remove deleted files from index (compare using relative paths)
        config.fileIndex = config.fileIndex.filter(
          (file) => !relativePathsToDelete.includes(file.path)
        )
        config.fileCount = config.fileIndex.filter((f) => f.exists).length
        config.updatedAt = new Date().toISOString()

        // Save updated config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

        return {
          success: true,
          deletedCount,
          failedFiles,
          remainingFileCount: config.fileCount
        }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // Update file tags
  ipcMain.handle(
    'directory:update-file-tags',
    async (_, directoryPath: string, fileId: string, tags: string[]) => {
      try {
        // Sanitize tags: trim whitespace, remove hashes, remove duplicates
        const sanitizedTags = sanitizeTags(tags)
        
        const configPath = path.join(directoryPath, 'panopticon.directory.json')

        if (!fs.existsSync(configPath)) {
          return { success: false, error: 'Directory config not found' }
        }

        const config: DirectoryConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

        // Find and update the file
        const fileIndex = config.fileIndex.findIndex((f) => f.id === fileId)
        if (fileIndex === -1) {
          return { success: false, error: 'File not found in directory index' }
        }

        config.fileIndex[fileIndex].tags = sanitizedTags
        config.updatedAt = new Date().toISOString()

        // Compile all unique tags from all files
        const allTagsSet = new Set<string>()
        config.fileIndex.forEach((file) => {
          if (file.tags && Array.isArray(file.tags)) {
            file.tags.forEach((tag) => allTagsSet.add(tag))
          }
        })
        config.allTags = Array.from(allTagsSet).sort()

        // Save updated config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

        return { success: true, tags: sanitizedTags }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )
}
