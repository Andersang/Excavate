/**
 * Shared domain interfaces used by both the main process and the preload layer.
 * Renderer components access these types via the global ambient declarations in
 * src/preload/index.d.ts — no direct import needed on the renderer side.
 */

export interface FileInfo {
  id: string
  name: string
  path: string
  size: number
  mtime: string
  extension: string
  exists: boolean
  tags?: string[]
}

export interface DirectoryConfig {
  createdAt: string
  updatedAt: string
  fileTypes: string[]
  fileCount: number
  fileIndex: FileInfo[]
  customExclusionPatterns: string[]
  allTags?: string[]
  bookmarks?: Bookmark[]
}

export interface DirectorySettings {
  watchForChanges: boolean
  excludePatterns: string[]
  fileTypes: string[]
}

export interface Directory {
  path: string
  name: string
  addedAt: string
  exists: boolean
  settings: DirectorySettings
  lastAccessed: string
}

export interface AppSettings {
  /** Date/time when settings were first initialized. Reserved for future analytics. */
  initTime?: string
  /** System/OS type identifier. Reserved for future platform-specific features. */
  systemType?: string
  offlineMode?: boolean
  /** Reserved for future collection management feature. */
  collections?: Record<string, unknown>
  directories: Record<string, Directory>
}

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
