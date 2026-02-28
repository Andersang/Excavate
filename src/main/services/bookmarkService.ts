import { readFile, writeFile } from 'fs/promises'
import { join, relative, isAbsolute } from 'path'
import { existsSync } from 'fs'
import { bookmarkLogger } from '../utils/logger'

export interface Bookmark {
  id: string
  fileId: string
  filePath: string
  fileName: string
  page: number
  name: string
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt?: string
}

interface DirectoryConfig {
  fileIndex?: Array<{
    id: string
    path: string
    name: string
    extension: string
    size: number
    modifiedAt: string
    tags?: string[]
  }>
  allTags?: string[]
  bookmarks?: Bookmark[]
}

/**
 * Service for managing PDF page bookmarks
 */
class BookmarkService {
  private configFileName = 'panopticon.directory.json'

  /**
   * Read directory config file
   */
  private async readConfig(directoryPath: string): Promise<DirectoryConfig> {
    const configPath = join(directoryPath, this.configFileName)

    if (!existsSync(configPath)) {
      return { fileIndex: [], allTags: [], bookmarks: [] }
    }

    try {
      const content = await readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      bookmarkLogger.error('Error reading config:', error)
      return { fileIndex: [], allTags: [], bookmarks: [] }
    }
  }

  /**
   * Write directory config file
   */
  private async writeConfig(directoryPath: string, config: DirectoryConfig): Promise<void> {
    const configPath = join(directoryPath, this.configFileName)

    try {
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
    } catch (error) {
      bookmarkLogger.error('Error writing config:', error)
      throw error
    }
  }

  /**
   * Generate a unique bookmark ID
   */
  private generateId(): string {
    return `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Resolve relative bookmark file paths to absolute
   */
  private resolveBookmarkPaths(bookmarks: Bookmark[], directoryPath: string): Bookmark[] {
    return bookmarks.map((bookmark) => ({
      ...bookmark,
      filePath: isAbsolute(bookmark.filePath)
        ? bookmark.filePath
        : join(directoryPath, bookmark.filePath)
    }))
  }

  /**
   * Add a new bookmark
   */
  async addBookmark(
    directoryPath: string,
    bookmark: Omit<Bookmark, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> {
    try {
      const config = await this.readConfig(directoryPath)

      // Store bookmark with relative path
      const relativePath = isAbsolute(bookmark.filePath)
        ? relative(directoryPath, bookmark.filePath)
        : bookmark.filePath

      const newBookmark: Bookmark = {
        ...bookmark,
        filePath: relativePath,
        id: this.generateId(),
        createdAt: new Date().toISOString()
      }

      if (!config.bookmarks) {
        config.bookmarks = []
      }

      config.bookmarks.push(newBookmark)

      await this.writeConfig(directoryPath, config)

      // Return bookmark with absolute path
      const resolvedBookmark = this.resolveBookmarkPaths([newBookmark], directoryPath)[0]
      bookmarkLogger.info('Added bookmark:', newBookmark.id)
      return { success: true, bookmark: resolvedBookmark }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      bookmarkLogger.error('Error adding bookmark:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(
    directoryPath: string,
    bookmarkId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.readConfig(directoryPath)

      if (!config.bookmarks) {
        return { success: false, error: 'No bookmarks found' }
      }

      const initialLength = config.bookmarks.length
      config.bookmarks = config.bookmarks.filter((b) => b.id !== bookmarkId)

      if (config.bookmarks.length === initialLength) {
        return { success: false, error: 'Bookmark not found' }
      }

      await this.writeConfig(directoryPath, config)

      bookmarkLogger.info('Removed bookmark:', bookmarkId)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      bookmarkLogger.error('Error removing bookmark:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Update a bookmark
   */
  async updateBookmark(
    directoryPath: string,
    bookmarkId: string,
    updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>>
  ): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> {
    try {
      const config = await this.readConfig(directoryPath)

      if (!config.bookmarks) {
        return { success: false, error: 'No bookmarks found' }
      }

      const bookmarkIndex = config.bookmarks.findIndex((b) => b.id === bookmarkId)

      if (bookmarkIndex === -1) {
        return { success: false, error: 'Bookmark not found' }
      }

      const updatedBookmark: Bookmark = {
        ...config.bookmarks[bookmarkIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      }

      config.bookmarks[bookmarkIndex] = updatedBookmark

      await this.writeConfig(directoryPath, config)

      bookmarkLogger.info('Updated bookmark:', bookmarkId)
      return { success: true, bookmark: updatedBookmark }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      bookmarkLogger.error('Error updating bookmark:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Get all bookmarks from a directory
   */
  async getBookmarks(
    directoryPath: string
  ): Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }> {
    try {
      const config = await this.readConfig(directoryPath)

      // Resolve relative paths to absolute
      const bookmarks = config.bookmarks || []
      const resolvedBookmarks = this.resolveBookmarkPaths(bookmarks, directoryPath)

      return {
        success: true,
        bookmarks: resolvedBookmarks
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      bookmarkLogger.error('Error getting bookmarks:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Get bookmarks for a specific file
   */
  async getFileBookmarks(
    directoryPath: string,
    fileId: string
  ): Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }> {
    try {
      const result = await this.getBookmarks(directoryPath)

      if (!result.success || !result.bookmarks) {
        return result
      }

      const fileBookmarks = result.bookmarks.filter((b) => b.fileId === fileId)

      return {
        success: true,
        bookmarks: fileBookmarks
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      bookmarkLogger.error('Error getting file bookmarks:', error)
      return { success: false, error: errorMessage }
    }
  }
}

export const bookmarkService = new BookmarkService()
