import { ElectronAPI } from '@electron-toolkit/preload'

interface SystemDependency {
  name: string
  version?: string
  isInstalled: boolean
  isValidVersion?: boolean
  requiredVersion?: string
  architecture?: string
  error?: string
}

interface DirectorySettings {
  watchForChanges: boolean
  excludePatterns: string[]
  fileTypes: string[]
}

interface Directory {
  path: string
  name: string
  addedAt: string
  exists: boolean
  settings: DirectorySettings
  lastAccessed: string
}

interface AppSettings {
  initTime?: string
  systemType?: string
  offlineMode?: boolean
  collections?: Record<string, any>
  directories: Record<string, Directory>
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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // App info APIs
      getAppVersion: () => Promise<string>

      // System status APIs
      getPythonStatus: () => Promise<SystemDependency>
      getTesseractStatus: () => Promise<SystemDependency>
      getGhostscriptStatus: () => Promise<SystemDependency>
      getPyPDF2Status: () => Promise<SystemDependency>

      // Dialog APIs
      dialog: {
        openDirectory: () => Promise<string | null>
      }

      // Directory APIs
      directory: {
        createConfig: (
          directoryPath: string,
          fileTypes: string[]
        ) => Promise<{ success: boolean; path?: string; error?: string }>
        readConfig: (
          directoryPath: string
        ) => Promise<{ success: boolean; config?: DirectoryConfig; error?: string }>
        index: (
          directoryPath: string,
          fileTypes: string[]
        ) => Promise<{
          success: boolean
          fileCount?: number
          fileIndex?: FileInfo[]
          isFirstScan?: boolean
          changes?: { added: number; modified: number; removed: number }
          error?: string
        }>
        indexAll: (
          directories: Record<string, Directory>
        ) => Promise<
          Record<
            string,
            { success: boolean; fileCount?: number; fileIndex?: FileInfo[]; error?: string }
          >
        >
        startWatch: (
          directoryId: string,
          directoryPath: string,
          fileTypes: string[]
        ) => Promise<{ success: boolean; error?: string }>
        stopWatch: (directoryId: string) => Promise<{ success: boolean; error?: string }>
        initWatchers: () => Promise<{ success: boolean; error?: string }>
        onDirectoryUpdated: (
          callback: (data: { directoryId: string; fileCount: number }) => void
        ) => void
        deleteFiles: (
          directoryPath: string,
          filePaths: string[]
        ) => Promise<{
          success: boolean
          deletedCount?: number
          failedFiles?: string[]
          remainingFileCount?: number
          error?: string
        }>
        updateFileTags: (
          directoryPath: string,
          fileId: string,
          tags: string[]
        ) => Promise<{
          success: boolean
          tags?: string[]
          error?: string
        }>
      }

      // Settings APIs
      settings: {
        settingsFileExists: () => Promise<boolean>
        getSettingsPath: () => Promise<string>
        createDefaultSettings: (offlineMode?: boolean) => Promise<void>
        getAll: () => Promise<AppSettings>
        getDirectories: () => Promise<Record<string, Directory>>
        getDirectory: (id: string) => Promise<Directory | null>
        addDirectory: (id: string, directory: Directory) => Promise<void>
        removeDirectory: (id: string) => Promise<void>
        updateDirectorySettings: (id: string, settings: Partial<DirectorySettings>) => Promise<void>
        updateDirectoryLastAccessed: (id: string) => Promise<void>
        updateDirectoryExists: (id: string, exists: boolean) => Promise<void>
        updateAllDirectoryExists: () => Promise<void>
        updateOfflineMode: (offlineMode: boolean) => Promise<void>
        reset: () => Promise<void>
      }

      // Secure Storage APIs
      secureStorage: {
        isAvailable: () => Promise<boolean>
        setItem: (key: string, value: string) => Promise<void>
        getItem: (key: string) => Promise<string | null>
        removeItem: (key: string) => Promise<void>
        hasItem: (key: string) => Promise<boolean>
        clear: () => Promise<void>
      }

      // Python Environment APIs
      python: {
        checkVenvStatus: () => Promise<{
          exists: boolean
          hasOcrmypdf: boolean
          ocrmypdfVersion?: string
          error?: string
        }>
        createVenv: () => Promise<{
          success: boolean
          stdout?: string
          stderr?: string
          error?: string
        }>
        installOcrmypdf: () => Promise<{
          success: boolean
          stdout?: string
          stderr?: string
          error?: string
        }>
        setupEnvironment: () => Promise<{
          success: boolean
          stdout?: string
          stderr?: string
          error?: string
        }>
        getVenvPath: () => Promise<string>
        getPythonExecutable: () => Promise<string>
        getOcrmypdfExecutable: () => Promise<string>
        onSetupProgress: (callback: (message: string) => void) => void
        removeSetupProgressListener: () => void
      }

      // Document Processing APIs
      document: {
        process: (
          filePath: string,
          options?: Record<string, unknown>
        ) => Promise<{
          success: boolean
          filePath: string
          fileName: string
          processingMethod: 'local'
          processedAt: string
          metadata: {
            pageCount: number
            fileSize: number
            processingTime: number
          }
          content: Array<{
            pageNumber: number
            content: string
          }>
          error?: string
        }>
        processBatch: (
          filePaths: string[],
          options?: Record<string, unknown>
        ) => Promise<
          Array<{
            success: boolean
            filePath: string
            fileName: string
            processingMethod: 'local'
            processedAt: string
            metadata: {
              pageCount: number
              fileSize: number
              processingTime: number
            }
            content: Array<{
              pageNumber: number
              content: string
            }>
            error?: string
          }>
        >
        checkLocalAvailable: () => Promise<{
          available: boolean
          error?: string
        }>
      }

      // Shell APIs
      shell: {
        openExternal: (url: string) => Promise<void>
      }

      // File APIs
      file: {
        exists: (filePath: string) => Promise<boolean>
        read: (filePath: string) => Promise<string>
        delete: (filePath: string) => Promise<boolean>
        readPdf: (filePath: string) => Promise<number[]>
      }

      // PDF APIs
      pdf: {
        createTemp: (originalPath: string) => Promise<string>
        removeTemp: (tempPath: string) => Promise<void>
        cleanupAll: () => Promise<void>
        getActiveTemps: () => Promise<Array<{ tempPath: string; originalPath: string; createdAt: number }>>
        getPageCount: (pdfPath: string) => Promise<number>
      }

      // Search History APIs
      search: {
        save: (name: string, query: string, tags: string[]) => Promise<SavedSearch>
        getSaved: () => Promise<SavedSearch[]>
        deleteSaved: (id: string) => Promise<boolean>
        updateSaved: (id: string, name: string) => Promise<boolean>
        updateLastUsed: (id: string) => Promise<void>
        addHistory: (
          searchText: string,
          query: string,
          tags: string[],
          resultCount?: number
        ) => Promise<void>
        getHistory: () => Promise<SearchHistoryEntry[]>
        clearHistory: () => Promise<boolean>
      }

      // Bookmark APIs
      bookmark: {
        add: (
          directoryPath: string,
          bookmark: Omit<Bookmark, 'id' | 'createdAt'>
        ) => Promise<{ success: boolean; bookmark?: Bookmark; error?: string }>
        remove: (
          directoryPath: string,
          bookmarkId: string
        ) => Promise<{ success: boolean; error?: string }>
        update: (
          directoryPath: string,
          bookmarkId: string,
          updates: Partial<Omit<Bookmark, 'id' | 'createdAt'>>
        ) => Promise<{ success: boolean; bookmark?: Bookmark; error?: string }>
        getAll: (
          directoryPath: string
        ) => Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }>
        getFile: (
          directoryPath: string,
          fileId: string
        ) => Promise<{ success: boolean; bookmarks?: Bookmark[]; error?: string }>
      }

      // Update Check APIs
      update: {
        check: () => Promise<UpdateCheckResult | null>
        checkNow: () => Promise<UpdateCheckResult>
        resetCheck: () => Promise<boolean>
      }
    }
  }
}

interface SavedSearch {
  id: string
  name: string
  query: string
  tags: string[]
  createdAt: string
  lastUsed?: string
}

interface SearchHistoryEntry {
  id: string
  searchText: string
  query: string
  tags: string[]
  timestamp: string
  resultCount?: number
}

interface Bookmark {
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

interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  downloadUrl?: string
  releaseNotes?: string
}
