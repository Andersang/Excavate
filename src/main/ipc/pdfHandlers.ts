import { ipcMain } from 'electron'
import { pdfTempService } from '../services/pdfTempService'
import { readFile } from 'fs/promises'
import { PDFParse } from 'pdf-parse'
import { pdfLogger } from '../utils/logger'
import { isPathAllowed } from '../utils/pathValidation'

/**
 * Register PDF-related IPC handlers
 */
export function registerPdfHandlers(): void {
  ipcMain.handle('pdf:create-temp', async (_, originalPath: string) => {
    return await pdfTempService.createTempPdf(originalPath)
  })

  ipcMain.handle('pdf:remove-temp', async (_, tempPath: string) => {
    await pdfTempService.removeTempPdf(tempPath)
  })

  ipcMain.handle('pdf:cleanup-all', async () => {
    await pdfTempService.cleanupAllTempFiles()
  })

  ipcMain.handle('pdf:get-active-temps', () => {
    return pdfTempService.getActiveTempFiles()
  })

  ipcMain.handle('pdf:get-page-count', async (_, pdfPath: string) => {
    if (!isPathAllowed(pdfPath)) {
      pdfLogger.warn('pdf:get-page-count rejected path outside allowed roots:', pdfPath)
      return 1 // Default to 1 page — do not leak path info
    }
    try {
      const buf = await readFile(pdfPath)
      const parser = new PDFParse({ data: buf })
      try {
        const result = await parser.getText()
        return result.total
      } finally {
        await parser.destroy()
      }
    } catch (error) {
      pdfLogger.error('Error getting page count:', error)
      return 1 // Default to 1 page if we can't determine
    }
  })
}
