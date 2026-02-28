import { ipcMain } from 'electron'
import { systemCheckService } from '../services/systemCheckService'

/**
 * Register system status IPC handlers
 */
export function registerSystemHandlers(): void {
  ipcMain.handle('get-python-status', async () => {
    return await systemCheckService.checkPython()
  })

  ipcMain.handle('get-tesseract-status', async () => {
    return await systemCheckService.checkTesseract()
  })

  ipcMain.handle('get-ghostscript-status', async () => {
    return await systemCheckService.checkGhostscript()
  })

  ipcMain.handle('get-pypdf2-status', async () => {
    return await systemCheckService.checkPyPDF2()
  })
}
