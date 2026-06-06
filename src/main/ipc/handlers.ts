import { ipcMain, app, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerDirectoryHandlers } from './directoryHandlers'
import { registerSecureStorageHandlers } from './secureStorageHandlers'
import { registerDocumentProcessingHandlers } from './documentProcessingHandlers'
import { registerSearchHistoryHandlers } from './searchHistoryHandlers'
import { registerPdfHandlers } from './pdfHandlers'
import { registerBookmarkHandlers } from './bookmarkHandlers'
import { registerUpdateCheckHandlers } from './updateCheckHandlers'
import { logger, pdfLogger } from '../utils/logger'
import { isPathAllowed } from '../utils/pathValidation'
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
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      logger.warn('shell:open-external rejected invalid URL:', url)
      throw new Error('Invalid URL')
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      logger.warn('shell:open-external rejected non-http(s) URL:', url)
      throw new Error(`Disallowed protocol: ${parsed.protocol}`)
    }
    await shell.openExternal(url)
  })

  // File handlers
  ipcMain.handle('file:exists', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) {
      logger.warn('file:exists rejected path outside allowed roots:', filePath)
      return false
    }
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('file:read', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) {
      logger.warn('file:read rejected path outside allowed roots:', filePath)
      throw new Error('Access denied: path outside allowed directories')
    }
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      logger.error('Error reading file:', error)
      throw error
    }
  })

  ipcMain.handle('file:delete', async (_, filePath: string) => {
    if (!isPathAllowed(filePath)) {
      logger.warn('file:delete rejected path outside allowed roots:', filePath)
      throw new Error('Access denied: path outside allowed directories')
    }
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

      if (!isPathAllowed(filePath)) {
        pdfLogger.warn('file:read-pdf rejected path outside allowed roots:', filePath)
        throw new Error('Access denied: path outside allowed directories')
      }

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

  // IPC test — dev only
  if (is.dev) {
    ipcMain.on('ping', () => logger.debug('pong'))
  }

  // Register specialized handlers
  registerSettingsHandlers()
  registerDirectoryHandlers()
  registerSecureStorageHandlers()
  registerDocumentProcessingHandlers()
  registerSearchHistoryHandlers()
  registerPdfHandlers()
  registerBookmarkHandlers()
  registerUpdateCheckHandlers()
}
