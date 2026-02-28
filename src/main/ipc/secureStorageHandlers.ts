import { ipcMain } from 'electron'
import { secureStorageService } from '../services/secureStorageService'

/**
 * Register secure storage IPC handlers
 */
export function registerSecureStorageHandlers(): void {
  ipcMain.handle('secure-storage:is-available', () => {
    return secureStorageService.isAvailable()
  })

  ipcMain.handle('secure-storage:set-item', async (_, key: string, value: string) => {
    await secureStorageService.setItem(key, value)
  })

  ipcMain.handle('secure-storage:get-item', async (_, key: string) => {
    return await secureStorageService.getItem(key)
  })

  ipcMain.handle('secure-storage:remove-item', async (_, key: string) => {
    await secureStorageService.removeItem(key)
  })

  ipcMain.handle('secure-storage:has-item', async (_, key: string) => {
    return await secureStorageService.hasItem(key)
  })

  ipcMain.handle('secure-storage:clear', async () => {
    await secureStorageService.clear()
  })
}
