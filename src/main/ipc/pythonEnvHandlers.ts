import { ipcMain } from 'electron'
import { pythonEnvService } from '../services/pythonEnvService'

/**
 * Register Python environment IPC handlers
 */
export function registerPythonEnvHandlers(): void {
  // Check virtual environment status
  ipcMain.handle('python:check-venv-status', async () => {
    return await pythonEnvService.checkVenvStatus()
  })

  // Create virtual environment
  ipcMain.handle('python:create-venv', async () => {
    return await pythonEnvService.createVenv()
  })

  // Install ocrmypdf
  ipcMain.handle('python:install-ocrmypdf', async () => {
    return await pythonEnvService.installOcrmypdf()
  })

  // Setup complete environment (venv + ocrmypdf)
  ipcMain.handle('python:setup-environment', async () => {
    return await pythonEnvService.setupEnvironment()
  })

  // Get venv path
  ipcMain.handle('python:get-venv-path', () => {
    return pythonEnvService.getVenvPath()
  })

  // Get Python executable path
  ipcMain.handle('python:get-python-executable', () => {
    return pythonEnvService.getPythonExecutable()
  })

  // Get ocrmypdf executable path
  ipcMain.handle('python:get-ocrmypdf-executable', () => {
    return pythonEnvService.getOcrmypdfExecutable()
  })
}
