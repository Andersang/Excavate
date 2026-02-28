import { ipcMain, app, shell } from 'electron'
import { registerSystemHandlers } from './systemHandlers'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerDirectoryHandlers } from './directoryHandlers'
import { registerSecureStorageHandlers } from './secureStorageHandlers'
import { registerPythonEnvHandlers } from './pythonEnvHandlers'
import { registerDocumentProcessingHandlers } from './documentProcessingHandlers'
import { registerSearchHistoryHandlers } from './searchHistoryHandlers'
import { registerPdfHandlers } from './pdfHandlers'
import { registerBookmarkHandlers } from './bookmarkHandlers'
import { registerUpdateCheckHandlers } from './updateCheckHandlers'
import { logger, pdfLogger } from '../utils/logger'
import path from 'path'
import fs from 'fs/promises'

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  // App info handlers
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // Shell handlers
  ipcMain.handle('shell:open-external', async (_, url: string) => {
    await shell.openExternal(url)
  })

  // File handlers
  ipcMain.handle('file:exists', async (_, filePath: string) => {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      logger.error('Error reading file:', error)
      throw error
    }
  })

  ipcMain.handle('file:delete', async (_, filePath: string) => {
    try {
      await fs.unlink(filePath)
      return true
    } catch (error) {
      logger.error('Error deleting file:', error)
      throw error
    }
  })

  ipcMain.handle('file:read-pdf', async (_, filePath: string) => {
    try {
      pdfLogger.info('Reading PDF file:', filePath)
      
      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        throw new Error(`PDF file not found: ${filePath}`)
      }
      
      // Check file extension
      const ext = path.extname(filePath).toLowerCase()
      if (ext !== '.pdf') {
        throw new Error(`Not a PDF file: ${filePath} (extension: ${ext})`)
      }
      
      // Read the PDF file as a buffer
      const buffer = await fs.readFile(filePath)
      pdfLogger.info('File read successfully, size:', buffer.length, 'bytes')
      
      // Check if buffer is empty
      if (buffer.length === 0) {
        throw new Error(`PDF file is empty: ${filePath}`)
      }
      
      // Convert to array for transfer over IPC
      const array = Array.from(new Uint8Array(buffer))
      pdfLogger.debug('Converted to array, length:', array.length)
      return array
    } catch (error) {
      pdfLogger.error('Error reading PDF file:', error)
      throw error
    }
  })

  // IPC test
  ipcMain.on('ping', () => logger.debug('pong'))

  // Register specialized handlers
  registerSystemHandlers()
  registerSettingsHandlers()
  registerDirectoryHandlers()
  registerSecureStorageHandlers()
  registerPythonEnvHandlers()
  registerDocumentProcessingHandlers()
  registerSearchHistoryHandlers()
  registerPdfHandlers()
  registerBookmarkHandlers()
  registerUpdateCheckHandlers()
}
