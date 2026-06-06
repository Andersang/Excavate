import { access, unlink, stat } from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { indexLogger } from '../utils/logger'
import { directoryConfigService } from './directoryConfigService'
import type { FileInfo, DirectoryConfig } from '../../shared/types'

export interface IndexResult {
  success: boolean
  fileCount: number
  fileIndex: FileInfo[]
  isFirstScan: boolean
  changes: { added: number; modified: number; removed: number }
}

export interface DeleteFilesResult {
  success: boolean
  deletedCount: number
  failedFiles: string[]
  remainingFileCount: number
}

const DEFAULT_EXCLUSION_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.svn/**',
  '.hg/**',
  'Thumbs.db',
  '.DS_Store'
]

function shouldExclude(filePath: string, rootPath: string, exclusionPatterns: string[]): boolean {
  const relativePath = path.relative(rootPath, filePath).replace(/\\/g, '/')
  for (const pattern of exclusionPatterns) {
    if (pattern.endsWith('/**')) {
      const dirPattern = pattern.slice(0, -3)
      if (relativePath.startsWith(dirPattern + '/') || relativePath === dirPattern) return true
    } else {
      if (relativePath === pattern || path.basename(filePath) === pattern) return true
    }
  }
  return false
}

function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1)
}

async function scanDirectory(
  dirPath: string,
  fileTypes: string[],
  exclusionPatterns: string[]
): Promise<FileInfo[]> {
  const files: FileInfo[] = []

  async function scanRecursive(currentPath: string): Promise<void> {
    try {
      const { readdir } = await import('fs/promises')
      const entries = await readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        if (shouldExclude(fullPath, dirPath, exclusionPatterns)) continue
        if (entry.isDirectory()) {
          await scanRecursive(fullPath)
        } else if (entry.isFile()) {
          const extension = getFileExtension(entry.name)
          if (fileTypes.includes(extension)) {
            try {
              const stats = await stat(fullPath)
              files.push({
                id: randomUUID(),
                name: entry.name,
                path: path.relative(dirPath, fullPath),
                size: stats.size,
                mtime: stats.mtime.toISOString(),
                extension,
                exists: true
              })
            } catch (error) {
              indexLogger.warn('Could not stat file:', fullPath, error)
            }
          }
        }
      }
    } catch (error) {
      indexLogger.warn('Could not read directory:', currentPath, error)
    }
  }

  await scanRecursive(dirPath)
  return files
}

async function incrementalScanDirectory(
  dirPath: string,
  existingIndex: FileInfo[],
  fileTypes: string[],
  exclusionPatterns: string[]
): Promise<{ files: FileInfo[]; added: number; modified: number; removed: number }> {
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
      const { readdir } = await import('fs/promises')
      const entries = await readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        if (shouldExclude(fullPath, dirPath, exclusionPatterns)) continue
        if (entry.isDirectory()) {
          await scanRecursive(fullPath)
        } else if (entry.isFile()) {
          const extension = getFileExtension(entry.name)
          if (fileTypes.includes(extension)) {
            try {
              const stats = await stat(fullPath)
              const relativePath = path.relative(dirPath, fullPath)
              seenPaths.add(relativePath)
              const existingFile = existingFiles.get(relativePath)
              const fileId = existingFile?.id ?? randomUUID()
              const newFile: FileInfo = {
                id: fileId,
                name: entry.name,
                path: relativePath,
                size: stats.size,
                mtime: stats.mtime.toISOString(),
                extension,
                exists: true
              }
              if (!existingFile) {
                added++
                currentFiles.push(newFile)
              } else if (existingFile.mtime !== newFile.mtime || existingFile.size !== newFile.size) {
                modified++
                currentFiles.push(newFile)
              } else {
                currentFiles.push({ ...existingFile, id: fileId, exists: true })
              }
            } catch (error) {
              indexLogger.warn('Could not stat file:', fullPath, error)
            }
          }
        }
      }
    } catch (error) {
      indexLogger.warn('Could not read directory:', currentPath, error)
    }
  }

  await scanRecursive(dirPath)

  let removed = 0
  for (const existingFile of existingIndex) {
    if (!seenPaths.has(existingFile.path)) {
      removed++
      currentFiles.push({ ...existingFile, exists: false })
    }
  }

  return { files: currentFiles, added, modified, removed }
}

class DirectoryIndexService {
  resolveFilePaths(files: FileInfo[], directoryPath: string): FileInfo[] {
    return files.map((file) => ({
      ...file,
      path: path.isAbsolute(file.path) ? file.path : path.join(directoryPath, file.path)
    }))
  }

  sanitizeTags(tags: string[]): string[] {
    const MAX_TAG_LENGTH = 100
    const TAG_CHAR_PATTERN = /^[a-zA-Z0-9-_\s]+$/
    const sanitized: string[] = []
    const seen = new Set<string>()
    
    for (const tag of tags) {
      const trimmed = tag.trim()
      
      // Skip empty, too long, or tags with hash character
      if (trimmed.length === 0 || trimmed.length > MAX_TAG_LENGTH || trimmed.includes('#')) {
        continue
      }
      
      // Validate character set (alphanumeric, hyphens, underscores, spaces)
      if (!TAG_CHAR_PATTERN.test(trimmed)) {
        continue
      }
      
      // Deduplicate
      if (!seen.has(trimmed)) {
        sanitized.push(trimmed)
        seen.add(trimmed)
      }
    }
    
    return sanitized
  }

  async createConfig(
    directoryPath: string,
    fileTypes: string[]
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    if (await directoryConfigService.exists(directoryPath)) {
      return { success: false, error: 'Configuration file already exists in this directory' }
    }
    const now = new Date().toISOString()
    const config: DirectoryConfig = {
      createdAt: now,
      updatedAt: now,
      fileTypes,
      fileCount: 0,
      fileIndex: [],
      customExclusionPatterns: []
    }
    try {
      await directoryConfigService.write(directoryPath, config)
      return { success: true, path: directoryConfigService.configPath(directoryPath) }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async readConfig(
    directoryPath: string
  ): Promise<{ success: boolean; config?: DirectoryConfig; error?: string }> {
    if (!(await directoryConfigService.exists(directoryPath))) {
      return { success: false, error: 'Directory has not been indexed yet' }
    }
    try {
      const config = await directoryConfigService.read(directoryPath)
      if (config.fileIndex) {
        config.fileIndex = this.resolveFilePaths(config.fileIndex, directoryPath)
      }
      return { success: true, config }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async indexDirectory(directoryPath: string, fileTypes: string[]): Promise<IndexResult> {
    let config: DirectoryConfig
    let fileIndex: FileInfo[]
    let isFirstScan = false
    let changeStats = { added: 0, modified: 0, removed: 0 }
    const allExclusionPatterns = [...DEFAULT_EXCLUSION_PATTERNS]

    if (!(await directoryConfigService.exists(directoryPath))) {
      isFirstScan = true
      const now = new Date().toISOString()
      config = {
        createdAt: now,
        updatedAt: now,
        fileTypes,
        fileCount: 0,
        fileIndex: [],
        customExclusionPatterns: []
      }
      fileIndex = await scanDirectory(directoryPath, fileTypes, allExclusionPatterns)
      changeStats.added = fileIndex.length
    } else {
      config = await directoryConfigService.read(directoryPath)
      allExclusionPatterns.push(...config.customExclusionPatterns)
      const scanResult = await incrementalScanDirectory(
        directoryPath,
        config.fileIndex,
        fileTypes,
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
    config.fileTypes = fileTypes
    const existingFileCount = fileIndex.filter((f) => f.exists).length
    config.fileCount = existingFileCount
    config.updatedAt = new Date().toISOString()
    await directoryConfigService.write(directoryPath, config)

    return { success: true, fileCount: existingFileCount, fileIndex, isFirstScan, changes: changeStats }
  }

  async deleteFiles(
    directoryPath: string,
    filePaths: string[]
  ): Promise<DeleteFilesResult> {
    if (!(await directoryConfigService.exists(directoryPath))) {
      throw new Error('Configuration file not found')
    }
    const config = await directoryConfigService.read(directoryPath)
    const relativePathsToDelete = filePaths.map((p) => path.relative(directoryPath, p))
    let deletedCount = 0
    const failedFiles: string[] = []

    for (const filePath of filePaths) {
      try {
        try {
          await access(filePath)
          await unlink(filePath)
        } catch {
          // File not on disk — still remove from index
        }
        deletedCount++
      } catch (error) {
        indexLogger.error(`Failed to delete file: ${filePath}`, error)
        failedFiles.push(filePath)
      }
    }

    config.fileIndex = config.fileIndex.filter((f) => !relativePathsToDelete.includes(f.path))
    config.fileCount = config.fileIndex.filter((f) => f.exists).length
    config.updatedAt = new Date().toISOString()
    await directoryConfigService.write(directoryPath, config)

    return { success: true, deletedCount, failedFiles, remainingFileCount: config.fileCount }
  }

  async updateFileTags(
    directoryPath: string,
    fileId: string,
    tags: string[]
  ): Promise<{ success: boolean; tags?: string[]; error?: string }> {
    if (!(await directoryConfigService.exists(directoryPath))) {
      return { success: false, error: 'Directory config not found' }
    }
    const config = await directoryConfigService.read(directoryPath)
    const fileIndex = config.fileIndex.findIndex((f) => f.id === fileId)
    if (fileIndex === -1) return { success: false, error: 'File not found in directory index' }

    const sanitizedTags = this.sanitizeTags(tags)
    config.fileIndex[fileIndex].tags = sanitizedTags
    config.updatedAt = new Date().toISOString()

    const allTagsSet = new Set<string>()
    for (const file of config.fileIndex) {
      if (Array.isArray(file.tags)) {
        file.tags.forEach((t) => allTagsSet.add(t))
      }
    }
    config.allTags = Array.from(allTagsSet).sort()

    await directoryConfigService.write(directoryPath, config)
    return { success: true, tags: sanitizedTags }
  }
}

export const directoryIndexService = new DirectoryIndexService()
