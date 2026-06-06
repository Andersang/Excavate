import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { settingsService } from './services/settingsService'
import { directoryWatcherService } from './services/directoryWatcherService'
import { pdfTempService } from './services/pdfTempService'
import { tesseractOcrService } from './services/tesseract-ocr-service'
import { registerIpcHandlers } from './ipc/handlers'
import { logger } from './utils/logger'

// Initialization function - runs on app startup
async function initApp(): Promise<void> {
  // Initialize PDF temp service
  await pdfTempService.initialize()
  logger.info('PDF temp service initialized')

  // Initialize settings service
  await settingsService.init()
  logger.info(
    'Settings initialized. Settings file exists:',
    settingsService.getSettingsFileExists()
  )

  // Register IPC handlers BEFORE initializing watchers so the watcher
  // callback channel (directory:updated) is available from the start.
  registerIpcHandlers()
  logger.info('IPC handlers registered')

  // Initialize directory watchers for auto-indexing
  await directoryWatcherService.initializeWatchers()

  logger.info('App initialization complete')
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // Remove the default title bar
    titleBarStyle: 'hidden',
    // Set icon for Windows and Linux
    icon,
    // Expose window controls in Windows / Linux
    ...(process.platform !== 'darwin'
      ? {
          titleBarOverlay: {
            color: '#00000000', // Transparent background
            symbolColor: '#FFFFFF', // White icons
            height: 32 // Match your titlebar height
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox disabled; see comment above
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Run initialization function
  await initApp()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.andersang.panopticon')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on app quit
app.on('before-quit', async () => {
  logger.info('App quitting, cleaning up…')
  await pdfTempService.cleanupAllTempFiles()
  await tesseractOcrService.dispose()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
