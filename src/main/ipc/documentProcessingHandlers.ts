import { ipcMain } from 'electron'
import { documentProcessingService } from '../services/documentProcessingService'
import { isPathAllowed } from '../utils/pathValidation'

/**
 * Register document processing IPC handlers
 */
export function registerDocumentProcessingHandlers(): void {
  // Process single document
  ipcMain.handle(
    'document:process',
    async (_, filePath: string, options?: Record<string, unknown>) => {
      if (!isPathAllowed(filePath)) {
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }
      return await documentProcessingService.processDocument(filePath, options)
    }
  )

  // Process multiple documents
  ipcMain.handle(
    'document:process-batch',
    async (_, filePaths: string[], options?: Record<string, unknown>) => {
      const blockedPath = filePaths.find((p) => !isPathAllowed(p))
      if (blockedPath) {
        return [{ success: false, error: 'Access denied: path outside allowed directories' }]
      }
      return await documentProcessingService.processDocuments(filePaths, options)
    }
  )

  // Check if local processing is available
  ipcMain.handle('document:check-local-available', async () => {
    return await documentProcessingService.isLocalProcessingAvailable()
  })
}
