import { ipcMain } from 'electron'
import { bookmarkService, Bookmark } from '../services/bookmarkService'

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
      return await bookmarkService.getFileBookmarks(directoryPath, fileId)
    }
  )

  console.log('[IPC] Bookmark handlers registered')
}
