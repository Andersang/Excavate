import { ipcMain } from 'electron'
import { updateCheckService } from '../services/updateCheckService'

/**
 * Register update check IPC handlers
 */
export function registerUpdateCheckHandlers(): void {
  // Check for updates (respects interval)
  ipcMain.handle('update:check', async () => {
    return await updateCheckService.checkForUpdatesIfNeeded()
  })

  // Force check for updates (ignores interval)
  ipcMain.handle('update:check-now', async () => {
    return await updateCheckService.checkForUpdates()
  })

  // Reset last check time
  ipcMain.handle('update:reset-check', () => {
    updateCheckService.resetLastCheck()
    return true
  })
}
