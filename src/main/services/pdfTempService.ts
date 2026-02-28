import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { app } from 'electron'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const readdir = promisify(fs.readdir)
const mkdir = promisify(fs.mkdir)

interface TempPdfInfo {
  tempPath: string
  originalPath: string
  createdAt: number
}

class PdfTempService {
  private tempDir: string
  private activeTempFiles: Map<string, TempPdfInfo> = new Map()
  private readonly MAX_TEMP_FILES = 3

  constructor() {
    // Use app's temp directory with a subfolder for our PDFs
    this.tempDir = path.join(app.getPath('temp'), 'panopticon-pdfs')
  }

  /**
   * Initialize the temp directory
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true })
      // Clean up any existing temp files from previous sessions
      await this.cleanupAllTempFiles()
    } catch (error) {
      console.error('Error initializing PDF temp service:', error)
    }
  }

  /**
   * Create a temporary copy of a PDF file
   */
  async createTempPdf(originalPath: string): Promise<string> {
    try {
      // Check if we already have a temp file for this PDF
      const existing = Array.from(this.activeTempFiles.values()).find(
        (info) => info.originalPath === originalPath
      )

      if (existing) {
        // Update access time
        const info = this.activeTempFiles.get(existing.tempPath)
        if (info) {
          info.createdAt = Date.now()
        }
        return existing.tempPath
      }

      // Read the original PDF
      const pdfBuffer = await readFile(originalPath)

      // Create unique temp filename
      const timestamp = Date.now()
      const originalName = path.basename(originalPath, path.extname(originalPath))
      const tempFileName = `${originalName}-${timestamp}.pdf`
      const tempPath = path.join(this.tempDir, tempFileName)

      // Write temp file
      await writeFile(tempPath, pdfBuffer)

      // Track this temp file
      this.activeTempFiles.set(tempPath, {
        tempPath,
        originalPath,
        createdAt: timestamp
      })

      // Clean up old files if we exceed the limit
      await this.cleanupOldTempFiles()

      console.log(`[PdfTempService] Created temp PDF: ${tempPath}`)
      return tempPath
    } catch (error) {
      console.error('[PdfTempService] Error creating temp PDF:', error)
      throw new Error(
        `Failed to create temporary PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Clean up old temp files, keeping only the most recent MAX_TEMP_FILES
   */
  private async cleanupOldTempFiles(): Promise<void> {
    if (this.activeTempFiles.size <= this.MAX_TEMP_FILES) {
      return
    }

    try {
      // Sort by creation time (oldest first)
      const sorted = Array.from(this.activeTempFiles.entries()).sort(
        ([, a], [, b]) => a.createdAt - b.createdAt
      )

      // Remove oldest files
      const toRemove = sorted.slice(0, sorted.length - this.MAX_TEMP_FILES)

      for (const [tempPath] of toRemove) {
        try {
          await unlink(tempPath)
          this.activeTempFiles.delete(tempPath)
          console.log(`[PdfTempService] Cleaned up old temp PDF: ${tempPath}`)
        } catch (error) {
          console.warn(`[PdfTempService] Failed to delete temp file ${tempPath}:`, error)
          // Remove from tracking even if delete failed
          this.activeTempFiles.delete(tempPath)
        }
      }
    } catch (error) {
      console.error('[PdfTempService] Error cleaning up old temp files:', error)
    }
  }

  /**
   * Clean up all temp files (used on app startup/shutdown)
   */
  async cleanupAllTempFiles(): Promise<void> {
    try {
      const files = await readdir(this.tempDir)

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filePath = path.join(this.tempDir, file)
          try {
            await unlink(filePath)
            console.log(`[PdfTempService] Cleaned up temp PDF: ${filePath}`)
          } catch (error) {
            console.warn(`[PdfTempService] Failed to delete temp file ${filePath}:`, error)
          }
        }
      }

      // Clear tracking
      this.activeTempFiles.clear()
    } catch (error) {
      // Directory might not exist yet, that's okay
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[PdfTempService] Error cleaning up all temp files:', error)
      }
    }
  }

  /**
   * Remove a specific temp file
   */
  async removeTempPdf(tempPath: string): Promise<void> {
    try {
      await unlink(tempPath)
      this.activeTempFiles.delete(tempPath)
      console.log(`[PdfTempService] Removed temp PDF: ${tempPath}`)
    } catch (error) {
      console.warn(`[PdfTempService] Failed to remove temp PDF ${tempPath}:`, error)
      // Remove from tracking even if delete failed
      this.activeTempFiles.delete(tempPath)
    }
  }

  /**
   * Get list of active temp files
   */
  getActiveTempFiles(): TempPdfInfo[] {
    return Array.from(this.activeTempFiles.values())
  }

  /**
   * Get temp directory path
   */
  getTempDir(): string {
    return this.tempDir
  }
}

// Export singleton instance
export const pdfTempService = new PdfTempService()
