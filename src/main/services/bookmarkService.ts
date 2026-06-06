import { join, relative, isAbsolute } from 'path'
import { randomUUID } from 'crypto'
import { bookmarkLogger } from '../utils/logger'
import { directoryConfigService } from './directoryConfigService'
import type { Bookmark } from '../../shared/types'

export type { Bookmark }

/**
 * Service for managing PDF page bookmarks
 */
class BookmarkService {
  private generateId(): string {
    return randomUUID()
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
      const config = await directoryConfigService.read(directoryPath)

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

      await directoryConfigService.write(directoryPath, config)

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
      const config = await directoryConfigService.read(directoryPath)

      if (!config.bookmarks) {
        return { success: false, error: 'No bookmarks found' }
      }

      const initialLength = config.bookmarks.length
      config.bookmarks = config.bookmarks.filter((b) => b.id !== bookmarkId)

      if (config.bookmarks.length === initialLength) {
        return { success: false, error: 'Bookmark not found' }
      }

      await directoryConfigService.write(directoryPath, config)

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
      const config = await directoryConfigService.read(directoryPath)

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

      await directoryConfigService.write(directoryPath, config)

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
      const config = await directoryConfigService.read(directoryPath)

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
