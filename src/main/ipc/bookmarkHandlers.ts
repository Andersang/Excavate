import { ipcMain } from 'electron'
import { bookmarkService, Bookmark } from '../services/bookmarkService'
import { bookmarkLogger } from '../utils/logger'
import { isPathAllowed } from '../utils/pathValidation'

/**
 * Register all bookmark-related IPC handlers
 */
export function registerBookmarkHandlers(): void {
  // Add bookmark
  ipcMain.handle(
    'bookmark:add',
    async (
      _event,
      directoryPath: string,
      bookmark: Omit<Bookmark, 'id' | 'createdAt'>
    ): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> => {
      if (!isPathAllowed(directoryPath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await bookmarkService.addBookmark(directoryPath, bookmark)
    }
  )

  // Remove bookmark
  ipcMain.handle(
    'bookmark:remove',
    async (
      _event,
      directoryPath: string,
      bookmarkId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!isPathAllowed(directoryPath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await bookmarkService.removeBookmark(directoryPath, bookmarkId)
    }
  )

  // Update bookmark
  ipcMain.handle(
    'bookmark:update',
    async (
      _event,
      directoryPath: string,
      bookmarkId: string,
      updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>>
    ): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> => {
      if (!isPathAllowed(directoryPath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await bookmarkService.updateBookmark(directoryPath, bookmarkId, updates)
    }
  )

  // Get all bookmarks from a directory
  ipcMain.handle(
    'bookmark:get-all',
    async (
      _event,
      directoryPath: string
    ): Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }> => {
      if (!isPathAllowed(directoryPath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await bookmarkService.getBookmarks(directoryPath)
    }
  )

  // Get bookmarks for a specific file
  ipcMain.handle(
    'bookmark:get-file',
    async (
      _event,
      directoryPath: string,
      fileId: string
    ): Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }> => {
      if (!isPathAllowed(directoryPath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await bookmarkService.getFileBookmarks(directoryPath, fileId)
    }
  )

  bookmarkLogger.info('[IPC] Bookmark handlers registered')
}
