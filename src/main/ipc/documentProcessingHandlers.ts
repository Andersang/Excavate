import { ipcMain } from 'electron'
import { documentProcessingService } from '../services/documentProcessingService'

/**
 * Register document processing IPC handlers
 */
export function registerDocumentProcessingHandlers(): void {
  // Process single document
  ipcMain.handle(
    'document:process',
    async (_, filePath: string, options?: Record<string, unknown>) => {
      return await documentProcessingService.processDocument(filePath, options)
    }
  )

  // Process multiple documents
  ipcMain.handle(
    'document:process-batch',
    async (_, filePaths: string[], options?: Record<string, unknown>) => {
      return await documentProcessingService.processDocuments(filePaths, options)
    }
  )

  // Check if local processing is available
  ipcMain.handle('document:check-local-available', async () => {
    return await documentProcessingService.isLocalProcessingAvailable()
  })
}
