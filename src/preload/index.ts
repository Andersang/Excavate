import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Directory, DirectorySettings, Bookmark } from '../shared/types'

// Map original callbacks to their ipcRenderer wrapper so removeListener gets the same reference
const _directoryUpdatedWrappers = new Map<
  (data: { directoryId: string; fileCount: number }) => void,
  (event: Electron.IpcRendererEvent, data: { directoryId: string; fileCount: number }) => void
>()

// Custom APIs for renderer
const api = {
  
  // App info APIs
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Dialog APIs
  dialog: {
    openDirectory: () => ipcRenderer.invoke('dialog:open-directory')
  },
  
  // Directory APIs
  directory: {
    createConfig: (directoryPath: string, fileTypes: string[]) =>
      ipcRenderer.invoke('directory:create-config', directoryPath, fileTypes),
    readConfig: (directoryPath: string) =>
      ipcRenderer.invoke('directory:read-config', directoryPath),
    index: (directoryPath: string, fileTypes: string[]) =>
      ipcRenderer.invoke('directory:index', directoryPath, fileTypes),
    indexAll: (directories: Record<string, unknown>) =>
      ipcRenderer.invoke('directory:index-all', directories),
    startWatch: (directoryId: string, directoryPath: string, fileTypes: string[]) =>
      ipcRenderer.invoke('directory:start-watch', directoryId, directoryPath, fileTypes),
    stopWatch: (directoryId: string) => ipcRenderer.invoke('directory:stop-watch', directoryId),
    initWatchers: () => ipcRenderer.invoke('directory:init-watchers'),
    onDirectoryUpdated: (callback: (data: { directoryId: string; fileCount: number }) => void) => {
      const wrapper = (
        _event: Electron.IpcRendererEvent,
        data: { directoryId: string; fileCount: number }
      ) => callback(data)
      _directoryUpdatedWrappers.set(callback, wrapper)
      ipcRenderer.on('directory:updated', wrapper)
    },
    offDirectoryUpdated: (callback: (data: { directoryId: string; fileCount: number }) => void) => {
      const wrapper = _directoryUpdatedWrappers.get(callback)
      if (wrapper) {
        ipcRenderer.removeListener('directory:updated', wrapper)
        _directoryUpdatedWrappers.delete(callback)
      }
    },
    deleteFiles: (directoryPath: string, filePaths: string[]) =>
      ipcRenderer.invoke('directory:delete-files', directoryPath, filePaths),
    updateFileTags: (directoryPath: string, fileId: string, tags: string[]) =>
      ipcRenderer.invoke('directory:update-file-tags', directoryPath, fileId, tags)
  },

  // Settings APIs
  settings: {
    settingsFileExists: () => ipcRenderer.invoke('settings:settings-file-exists'),
    getSettingsPath: () => ipcRenderer.invoke('settings:get-settings-path'),
    createDefaultSettings: (offlineMode?: boolean) =>
      ipcRenderer.invoke('settings:create-default', offlineMode),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    getDirectories: () => ipcRenderer.invoke('settings:get-directories'),
    getDirectory: (id: string) => ipcRenderer.invoke('settings:get-directory', id),
    addDirectory: (id: string, directory: Directory) =>
      ipcRenderer.invoke('settings:add-directory', id, directory),
    removeDirectory: (id: string) => ipcRenderer.invoke('settings:remove-directory', id),
    updateDirectorySettings: (id: string, settings: Partial<DirectorySettings>) =>
      ipcRenderer.invoke('settings:update-directory-settings', id, settings),
    updateDirectoryLastAccessed: (id: string) =>
      ipcRenderer.invoke('settings:update-directory-last-accessed', id),
    updateDirectoryExists: (id: string, exists: boolean) =>
      ipcRenderer.invoke('settings:update-directory-exists', id, exists),
    updateAllDirectoryExists: () => ipcRenderer.invoke('settings:update-all-directory-exists'),
    updateOfflineMode: (offlineMode: boolean) =>
      ipcRenderer.invoke('settings:update-offline-mode', offlineMode),
    reset: () => ipcRenderer.invoke('settings:reset')
  },

  // Secure Storage APIs
  secureStorage: {
    isAvailable: () => ipcRenderer.invoke('secure-storage:is-available'),
    setItem: (key: string, value: string) =>
      ipcRenderer.invoke('secure-storage:set-item', key, value),
    getItem: (key: string) => ipcRenderer.invoke('secure-storage:get-item', key),
    removeItem: (key: string) => ipcRenderer.invoke('secure-storage:remove-item', key),
    hasItem: (key: string) => ipcRenderer.invoke('secure-storage:has-item', key),
    clear: () => ipcRenderer.invoke('secure-storage:clear')
  },

  // Document Processing APIs
  document: {
    process: (filePath: string, options?: Record<string, unknown>) =>
      ipcRenderer.invoke('document:process', filePath, options),
    processBatch: (filePaths: string[], options?: Record<string, unknown>) =>
      ipcRenderer.invoke('document:process-batch', filePaths, options),
    checkLocalAvailable: () => ipcRenderer.invoke('document:check-local-available')
  },

  // Shell APIs
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },

  // File APIs
  file: {
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    readPdf: (filePath: string) => ipcRenderer.invoke('file:read-pdf', filePath)
  },

  // Search History APIs
  search: {
    save: (name: string, query: string, tags: string[]) =>
      ipcRenderer.invoke('search:save', name, query, tags),
    getSaved: () => ipcRenderer.invoke('search:get-saved'),
    deleteSaved: (id: string) => ipcRenderer.invoke('search:delete-saved', id),
    updateSaved: (id: string, name: string) => ipcRenderer.invoke('search:update-saved', id, name),
    updateLastUsed: (id: string) => ipcRenderer.invoke('search:update-last-used', id),
    addHistory: (searchText: string, query: string, tags: string[], resultCount?: number) =>
      ipcRenderer.invoke('search:add-history', searchText, query, tags, resultCount),
    getHistory: () => ipcRenderer.invoke('search:get-history'),
    clearHistory: () => ipcRenderer.invoke('search:clear-history')
  },

  // PDF APIs
  pdf: {
    createTemp: (originalPath: string) => ipcRenderer.invoke('pdf:create-temp', originalPath),
    removeTemp: (tempPath: string) => ipcRenderer.invoke('pdf:remove-temp', tempPath),
    cleanupAll: () => ipcRenderer.invoke('pdf:cleanup-all'),
    getActiveTemps: () => ipcRenderer.invoke('pdf:get-active-temps'),
    getPageCount: (pdfPath: string) => ipcRenderer.invoke('pdf:get-page-count', pdfPath)
  },

  // Bookmark APIs
  bookmark: {
    add: (directoryPath: string, bookmark: Omit<Bookmark, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke('bookmark:add', directoryPath, bookmark),
    remove: (directoryPath: string, bookmarkId: string) =>
      ipcRenderer.invoke('bookmark:remove', directoryPath, bookmarkId),
    update: (directoryPath: string, bookmarkId: string, updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>>) =>
      ipcRenderer.invoke('bookmark:update', directoryPath, bookmarkId, updates),
    getAll: (directoryPath: string) => ipcRenderer.invoke('bookmark:get-all', directoryPath),
    getFile: (directoryPath: string, fileId: string) =>
      ipcRenderer.invoke('bookmark:get-file', directoryPath, fileId)
  },

  // Update Check APIs
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    checkNow: () => ipcRenderer.invoke('update:check-now'),
    resetCheck: () => ipcRenderer.invoke('update:reset-check')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] contextBridge setup failed:', error)
  }
} else {
  // In non-isolated mode the node tsconfig doesn't include DOM, so cast explicitly
  const win = window as unknown as { electron: typeof electronAPI; api: typeof api }
  win.electron = electronAPI
  win.api = api
}
