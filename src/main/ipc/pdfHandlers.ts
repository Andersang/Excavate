import { ipcMain } from 'electron'
import { pdfTempService } from '../services/pdfTempService'
import { pythonEnvService } from '../services/pythonEnvService'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec)

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
    try {
      const venvStatus = await pythonEnvService.checkVenvStatus()
      if (!venvStatus.exists) {
        throw new Error('Python virtual environment not found')
      }

      const pythonPath = pythonEnvService.getPythonExecutable()
      const command = `"${pythonPath}" -c "import PyPDF2; reader = PyPDF2.PdfReader('${pdfPath.replace(/\\/g, '\\\\')}'); print(len(reader.pages))"`

      const { stdout } = await execAsync(command, {
        maxBuffer: 1024 * 1024 // 1MB buffer
      })

      const pageCount = parseInt(stdout.trim(), 10)
      return isNaN(pageCount) ? 1 : pageCount
    } catch (error) {
      console.error('[PDF] Error getting page count:', error)
      return 1 // Default to 1 page if we can't determine
    }
  })
}
