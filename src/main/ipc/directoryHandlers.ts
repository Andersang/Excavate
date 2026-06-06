import { ipcMain, dialog, BrowserWindow } from 'electron'
import { directoryWatcherService } from '../services/directoryWatcherService'
import { directoryIndexService } from '../services/directoryIndexService'
import { indexLogger } from '../utils/logger'
import { isPathAllowed } from '../utils/pathValidation'
import type { Directory } from '../../shared/types'

const ACCESS_DENIED = 'Access denied: path outside allowed directories'

export function registerDirectoryHandlers(): void {
  directoryWatcherService.setIndexCallback(async (directoryId, directoryPath, fileTypes) => {
    try {
      const result = await directoryIndexService.indexDirectory(directoryPath, fileTypes)
      indexLogger.info(`[Watcher] Auto-indexed ${directoryId}: ${result.fileCount} files`)
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('directory:updated', { directoryId, fileCount: result.fileCount })
      })
    } catch (error) {
      indexLogger.error(`[Watcher] Failed to auto-index ${directoryId}:`, error)
      // Notify renderer of indexing failure so users are aware
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('directory:index-error', {
          directoryId,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }
  })

  ipcMain.handle('dialog:open-directory', async () => {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'directory:create-config',
    async (_event, directoryPath: string, fileTypes: string[]) => {
      if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
      return directoryIndexService.createConfig(directoryPath, fileTypes)
    }
  )

  ipcMain.handle('directory:read-config', async (_event, directoryPath: string) => {
    if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
    return directoryIndexService.readConfig(directoryPath)
  })

  ipcMain.handle('directory:index', async (_event, directoryPath: string, fileTypes: string[]) => {
    if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
    try {
      const result = await directoryIndexService.indexDirectory(directoryPath, fileTypes)
      result.fileIndex = directoryIndexService.resolveFilePaths(result.fileIndex, directoryPath)
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('directory:index-all', async (_event, directories: Record<string, Directory>) => {
    const settled = await Promise.allSettled(
      Object.entries(directories).map(async ([id, dir]) => {
        if (!dir.exists) return [id, { success: false, error: 'Directory does not exist' }] as const
        if (!isPathAllowed(dir.path)) return [id, { success: false, error: ACCESS_DENIED }] as const
        const fileTypes = dir.settings?.fileTypes ?? ['pdf', 'markdown', 'md']
        const result = await directoryIndexService.indexDirectory(dir.path, fileTypes)
        result.fileIndex = directoryIndexService.resolveFilePaths(result.fileIndex, dir.path)
        return [id, result] as const
      })
    )
    const results: Record<string, unknown> = {}
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const [id, result] = outcome.value
        results[id] = result
      } else {
        indexLogger.error('index-all unexpected rejection:', outcome.reason)
      }
    }
    return results
  })

  ipcMain.handle(
    'directory:start-watch',
    async (_event, directoryId: string, directoryPath: string, fileTypes: string[]) => {
      if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
      try {
        await directoryWatcherService.watchDirectory(directoryId, directoryPath, fileTypes)
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle('directory:stop-watch', async (_event, directoryId: string) => {
    try {
      await directoryWatcherService.unwatchDirectory(directoryId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('directory:init-watchers', async () => {
    try {
      await directoryWatcherService.initializeWatchers()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'directory:delete-files',
    async (_event, directoryPath: string, filePaths: string[]) => {
      if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
      if (filePaths.some((p) => !isPathAllowed(p))) return { success: false, error: ACCESS_DENIED }
      try {
        return await directoryIndexService.deleteFiles(directoryPath, filePaths)
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    'directory:update-file-tags',
    async (_event, directoryPath: string, fileId: string, tags: string[]) => {
      if (!isPathAllowed(directoryPath)) return { success: false, error: ACCESS_DENIED }
      return directoryIndexService.updateFileTags(directoryPath, fileId, tags)
    }
  )
}
