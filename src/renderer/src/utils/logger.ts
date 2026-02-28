import log from 'electron-log'

// Configure renderer logger
log.transports.console.level = 'debug'
log.transports.ipc.level = 'info'

// Export scoped loggers for renderer
export const logger = log.scope('renderer')
export const uiLogger = log.scope('ui')
export const searchLogger = log.scope('search')
export const viewLogger = log.scope('view')
export const indexLogger = log.scope('indexer')

// Export default
export default logger
