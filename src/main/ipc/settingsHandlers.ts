import { ipcMain } from 'electron'
import { settingsService } from '../services/settingsService'

/**
 * Register settings IPC handlers
 */
export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:settings-file-exists', () => {
    return settingsService.getSettingsFileExists()
  })

  ipcMain.handle('settings:get-settings-path', () => {
    return settingsService.getSettingsPath()
  })

  ipcMain.handle('settings:create-default', async (_, offlineMode: boolean = true) => {
    await settingsService.createDefaultSettings(offlineMode)
  })

  ipcMain.handle('settings:get-all', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:get-directories', () => {
    return settingsService.getDirectories()
  })

  ipcMain.handle('settings:get-directory', (_, id: string) => {
    return settingsService.getDirectory(id)
  })

  ipcMain.handle('settings:add-directory', async (_, id: string, directory) => {
    await settingsService.addDirectory(id, directory)
  })

  ipcMain.handle('settings:remove-directory', async (_, id: string) => {
    await settingsService.removeDirectory(id)
  })

  ipcMain.handle('settings:update-directory-settings', async (_, id: string, settings) => {
    await settingsService.updateDirectorySettings(id, settings)
  })

  ipcMain.handle('settings:update-directory-last-accessed', async (_, id: string) => {
    await settingsService.updateDirectoryLastAccessed(id)
  })

  ipcMain.handle('settings:update-directory-exists', async (_, id: string, exists: boolean) => {
    await settingsService.updateDirectoryExists(id, exists)
  })

  ipcMain.handle('settings:update-all-directory-exists', async () => {
    await settingsService.updateAllDirectoryExists()
  })

  ipcMain.handle('settings:update-offline-mode', async (_, offlineMode: boolean) => {
    await settingsService.updateOfflineMode(offlineMode)
  })

  ipcMain.handle('settings:reset', async () => {
    await settingsService.reset()
  })
}
