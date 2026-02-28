import { ipcMain } from 'electron'
import { searchHistoryService } from '../services/searchHistoryService'

/**
 * Register search history IPC handlers
 */
export function registerSearchHistoryHandlers(): void {
  // ==================== SAVED SEARCHES ====================

  // Save a search
  ipcMain.handle('search:save', async (_, name: string, query: string, tags: string[]) => {
    return await searchHistoryService.saveSearch(name, query, tags)
  })

  // Get all saved searches
  ipcMain.handle('search:get-saved', async () => {
    return await searchHistoryService.getSavedSearches()
  })

  // Delete a saved search
  ipcMain.handle('search:delete-saved', async (_, id: string) => {
    return await searchHistoryService.deleteSavedSearch(id)
  })

  // Update saved search name
  ipcMain.handle('search:update-saved', async (_, id: string, name: string) => {
    return await searchHistoryService.updateSavedSearch(id, name)
  })

  // Update last used timestamp
  ipcMain.handle('search:update-last-used', async (_, id: string) => {
    return await searchHistoryService.updateLastUsed(id)
  })

  // ==================== SEARCH HISTORY ====================

  // Add to search history
  ipcMain.handle(
    'search:add-history',
    async (_, searchText: string, query: string, tags: string[], resultCount?: number) => {
      return await searchHistoryService.addToHistory(searchText, query, tags, resultCount)
    }
  )

  // Get search history
  ipcMain.handle('search:get-history', async () => {
    return await searchHistoryService.getHistory()
  })

  // Clear search history
  ipcMain.handle('search:clear-history', async () => {
    return await searchHistoryService.clearHistory()
  })
}
