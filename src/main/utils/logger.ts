import log from 'electron-log'
import { app } from 'electron'
import * as path from 'path'

// Configure electron-log
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

// Set log file location
const logsPath = path.join(app.getPath('userData'), 'logs')
log.transports.file.resolvePathFn = () => path.join(logsPath, 'main.log')

// File rotation settings
log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

// Export scoped loggers for different modules
export const logger = log.scope('main')
export const pdfLogger = log.scope('pdf')
export const ocrLogger = log.scope('ocr')
export const watcherLogger = log.scope('watcher')
export const bookmarkLogger = log.scope('bookmark')
export const settingsLogger = log.scope('settings')
export const pythonLogger = log.scope('python')
export const indexLogger = log.scope('indexer')

// Export default
export default logger
