import { mkdir, readFile, writeFile, access, constants } from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { searchLogger } from '../utils/logger'

const MAX_HISTORY_ENTRIES = 50

export interface SavedSearch {
  id: string
  name: string
  query: string
  tags: string[]
  createdAt: string
  lastUsed?: string
}

export interface SearchHistoryEntry {
  id: string
  searchText: string // Full search string with tags in original order
  query: string
  tags: string[]
  timestamp: string
  resultCount?: number
}

interface SearchHistory {
  searches: SearchHistoryEntry[]
}

class SearchHistoryService {
  private searchesDir: string
  private savedSearchesPath: string
  private historyPath: string

  // In-memory caches
  private savedSearchesCache: SavedSearch[] = []
  private historyCache: SearchHistory = { searches: [] }
  private isInitialized = false

  constructor() {
    const documentsPath = app.getPath('documents')
    this.searchesDir = path.join(documentsPath, 'Panopticon', 'saved-searches')
    this.savedSearchesPath = path.join(this.searchesDir, 'saved-searches.json')
    this.historyPath = path.join(this.searchesDir, 'search-history.json')
  }

  /**
   * Ensure the searches directory exists and caches are loaded
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return

    try {
      await access(this.searchesDir, constants.F_OK)
    } catch {
      await mkdir(this.searchesDir, { recursive: true })
      searchLogger.info('Created searches directory:', this.searchesDir)
    }

    // Load caches on first use
    this.savedSearchesCache = await this.readSavedSearchesFromDisk()
    this.historyCache = await this.readHistoryFromDisk()
    this.isInitialized = true
  }

  // ==================== SAVED SEARCHES ====================

  /**
   * Save a search (with duplicate prevention)
   */
  async saveSearch(name: string, query: string, tags: string[]): Promise<SavedSearch> {
    await this.ensureInitialized()

    // Check if search with this name already exists
    const existingIndex = this.savedSearchesCache.findIndex((s) => s.name === name)
    if (existingIndex !== -1) {
      // Return existing search instead of creating duplicate
      return this.savedSearchesCache[existingIndex]
    }

    const newSearch: SavedSearch = {
      id: randomUUID(),
      name,
      query,
      tags,
      createdAt: new Date().toISOString()
    }

    this.savedSearchesCache.push(newSearch)
    await this.writeSavedSearches(this.savedSearchesCache)

    searchLogger.debug('Saved search:', name)
    return newSearch
  }

  /**
   * Get all saved searches (from cache)
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    await this.ensureInitialized()
    return [...this.savedSearchesCache] // Return copy to prevent external mutation
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(id: string): Promise<boolean> {
    await this.ensureInitialized()

    const initialLength = this.savedSearchesCache.length
    this.savedSearchesCache = this.savedSearchesCache.filter((s) => s.id !== id)

    if (this.savedSearchesCache.length === initialLength) {
      return false // Not found
    }

    await this.writeSavedSearches(this.savedSearchesCache)
    searchLogger.debug('Deleted saved search:', id)
    return true
  }

  /**
   * Update a saved search name
   */
  async updateSavedSearch(id: string, name: string): Promise<boolean> {
    await this.ensureInitialized()

    const search = this.savedSearchesCache.find((s) => s.id === id)

    if (!search) {
      return false
    }

    search.name = name
    await this.writeSavedSearches(this.savedSearchesCache)
    searchLogger.debug('Updated saved search:', id)
    return true
  }

  /**
   * Update last used timestamp for a saved search
   */
  async updateLastUsed(id: string): Promise<void> {
    await this.ensureInitialized()

    const search = this.savedSearchesCache.find((s) => s.id === id)

    if (search) {
      search.lastUsed = new Date().toISOString()
      await this.writeSavedSearches(this.savedSearchesCache)
    }
  }

  /**
   * Read saved searches from disk
   */
  private async readSavedSearchesFromDisk(): Promise<SavedSearch[]> {
    try {
      await access(this.savedSearchesPath, constants.F_OK)
      const content = await readFile(this.savedSearchesPath, 'utf-8')
      const parsed = JSON.parse(content)
      
      // Validate structure
      if (!Array.isArray(parsed)) {
        searchLogger.warn('Invalid saved searches format: expected array')
        return []
      }
      
      // Validate each entry has required fields
      return parsed.filter((entry): entry is SavedSearch => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.id === 'string' &&
          typeof entry.name === 'string' &&
          typeof entry.searchText === 'string' &&
          typeof entry.query === 'string' &&
          Array.isArray(entry.tags) &&
          typeof entry.createdAt === 'string'
        )
      })
    } catch {
      return []
    }
  }

  /**
   * Write saved searches to file (optimized without pretty formatting)
   */
  private async writeSavedSearches(searches: SavedSearch[]): Promise<void> {
    await writeFile(this.savedSearchesPath, JSON.stringify(searches), 'utf-8')
  }

  // ==================== SEARCH HISTORY ====================

  /**
   * Add search to history (auto-called after each search, with duplicate prevention)
   */
  async addToHistory(
    searchText: string,
    query: string,
    tags: string[],
    resultCount?: number
  ): Promise<void> {
    await this.ensureInitialized()

    // Check if this exact search already exists in history
    const existingIndex = this.historyCache.searches.findIndex(
      (entry) => entry.searchText === searchText
    )

    // If it exists, remove it so we can add it at the top
    if (existingIndex !== -1) {
      this.historyCache.searches.splice(existingIndex, 1)
    }

    const newEntry: SearchHistoryEntry = {
      id: randomUUID(),
      searchText,
      query,
      tags,
      timestamp: new Date().toISOString(),
      resultCount
    }

    // Add to beginning of array
    this.historyCache.searches.unshift(newEntry)

    // Keep only last MAX_HISTORY_ENTRIES
    if (this.historyCache.searches.length > MAX_HISTORY_ENTRIES) {
      this.historyCache.searches = this.historyCache.searches.slice(0, MAX_HISTORY_ENTRIES)
    }

    await this.writeHistory(this.historyCache)
    searchLogger.debug('Added to search history:', query)
  }

  /**
   * Get search history (from cache)
   */
  async getHistory(): Promise<SearchHistoryEntry[]> {
    await this.ensureInitialized()
    return [...this.historyCache.searches] // Return copy to prevent external mutation
  }

  /**
   * Clear all search history
   */
  async clearHistory(): Promise<boolean> {
    await this.ensureInitialized()

    this.historyCache = { searches: [] }
    await this.writeHistory(this.historyCache)

    searchLogger.info('Cleared search history')
    return true
  }

  /**
   * Read search history from disk
   */
  private async readHistoryFromDisk(): Promise<SearchHistory> {
    try {
      await access(this.historyPath, constants.F_OK)
      const content = await readFile(this.historyPath, 'utf-8')
      return JSON.parse(content) as SearchHistory
    } catch {
      return { searches: [] }
    }
  }

  /**
   * Write search history to file (optimized without pretty formatting)
   */
  private async writeHistory(history: SearchHistory): Promise<void> {
    await writeFile(this.historyPath, JSON.stringify(history), 'utf-8')
  }
}

// Export singleton instance
export const searchHistoryService = new SearchHistoryService()
