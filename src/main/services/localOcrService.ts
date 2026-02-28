import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { exec } from 'child_process'
import { pythonEnvService } from './pythonEnvService'
import { ocrLogger } from '../utils/logger'

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)
const access = promisify(fs.access)
const stat = promisify(fs.stat)
const mkdir = promisify(fs.mkdir)
const execAsync = promisify(exec)

export interface PageContent {
  pageNumber: number
  content: string // All content combined (text, table descriptions, image descriptions)
}

export interface ProcessedDocument {
  success: boolean
  filePath: string
  fileName: string
  processingMethod: 'local'
  processedAt: string
  metadata: {
    pageCount: number
    fileSize: number
    processingTime: number // milliseconds
  }
  content: PageContent[]
  error?: string
}

class LocalOcrService {
  /**
   * Check if the local OCR environment is ready
   */
  async isReady(): Promise<{ ready: boolean; error?: string }> {
    const status = await pythonEnvService.checkVenvStatus()

    if (!status.exists) {
      return {
        ready: false,
        error: 'Python virtual environment not found. Please set up the environment first.'
      }
    }

    if (!status.hasOcrmypdf) {
      return {
        ready: false,
        error: 'ocrmypdf not installed in virtual environment. Please set up the environment first.'
      }
    }

    return { ready: true }
  }

  /**
   * Check if file is a PDF by MIME type
   */
  private async isPdf(filePath: string): Promise<boolean> {
    try {
      // Read first few bytes to check PDF signature
      const buffer = Buffer.alloc(4)
      const fd = await fs.promises.open(filePath, 'r')
      await fd.read(buffer, 0, 4, 0)
      await fd.close()

      // PDF files start with %PDF
      return buffer.toString('ascii', 0, 4) === '%PDF'
    } catch (error) {
      ocrLogger.error('Error checking file type:', error)
      return false
    }
  }

  /**
   * Get the output JSON path for processed document
   */
  private getProcessedJsonPath(filePath: string): string {
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath, path.extname(filePath))
    return path.join(dir, 'panopticon-processed', `${fileName}-processed.json`)
  }

  /**
   * Check if document has already been processed
   */
  private async isAlreadyProcessed(filePath: string): Promise<boolean> {
    const jsonPath = this.getProcessedJsonPath(filePath)
    try {
      await access(jsonPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Save processed document to JSON
   */
  private async saveProcessedDocument(
    filePath: string,
    document: ProcessedDocument
  ): Promise<void> {
    const jsonPath = this.getProcessedJsonPath(filePath)
    const jsonDir = path.dirname(jsonPath)

    // Create directory structure
    await mkdir(jsonDir, { recursive: true })

    // Write JSON file
    await writeFile(jsonPath, JSON.stringify(document, null, 2), 'utf-8')
    ocrLogger.info('Processed document saved to:', jsonPath)
  }

  /**
   * Process a PDF document using local OCR (ocrmypdf + Python extraction)
   */
  async processDocument(filePath: string): Promise<ProcessedDocument> {
    const startTime = Date.now()
    const fileName = path.basename(filePath)

    try {
      // 1. Check if environment is ready
      const readyCheck = await this.isReady()
      if (!readyCheck.ready) {
        throw new Error(readyCheck.error)
      }

      // 2. Verify input file exists and is a PDF
      await access(filePath, fs.constants.F_OK)
      const fileStats = await stat(filePath)

      const isPdf = await this.isPdf(filePath)
      if (!isPdf) {
        throw new Error('File is not a PDF. Only PDF files are currently supported.')
      }

      ocrLogger.info('Processing PDF with local OCR:', filePath)

      // 3. Check if already processed
      const alreadyProcessed = await this.isAlreadyProcessed(filePath)
      if (alreadyProcessed) {
        ocrLogger.info('Document already processed, loading from cache...')
        const jsonPath = this.getProcessedJsonPath(filePath)
        const cachedData = await readFile(jsonPath, 'utf-8')
        return JSON.parse(cachedData)
      }

      // 4. Create temporary output path for OCR'd PDF
      const tempDir = app.getPath('temp')
      const tempOutput = path.join(tempDir, `ocr_${Date.now()}_${fileName}`)

      ocrLogger.info('Running ocrmypdf...')

      let content: PageContent[]
      let usedOcr = false

      try {
        // 5. Run ocrmypdf with specified options
        const inputDir = path.dirname(filePath)
        const pythonPath = pythonEnvService.getPythonExecutable()
        const args: string[] = ['-m', 'ocrmypdf']

        // Add OCR options
        args.push('--rotate-pages') // Auto-rotate pages
        args.push('--image-dpi', '300') // Set DPI to 300
        args.push('--force-ocr') // Force OCR on all pages
        args.push('--output-type', 'pdf') // Output regular PDF instead of PDF/A for better compatibility

        // Add input and output paths
        args.push(`"${filePath}"`, `"${tempOutput}"`)

        const command = `"${pythonPath}" ${args.join(' ')}`

        ocrLogger.debug('OCR Processing command:', command)
        ocrLogger.debug('OCR Processing input:', filePath)
        ocrLogger.debug('OCR Processing output:', tempOutput)

        // Execute the command
        const { stderr } = await execAsync(command, {
          cwd: inputDir,
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 50 * 1024 * 1024 // 50MB buffer
        })

        if (stderr && stderr.includes('ERROR')) {
          ocrLogger.error('OCR stderr:', stderr)
        }

        ocrLogger.info('OCR completed, extracting text with Python script...')

        // 6. Extract text from OCR'd PDF using Python script
        content = await this.extractTextFromPdf(tempOutput)
        usedOcr = true

        // Clean up temporary file
        try {
          await unlink(tempOutput)
        } catch (cleanupError) {
          ocrLogger.warn('Failed to clean up temporary OCR file:', cleanupError)
        }
      } catch (ocrError) {
        ocrLogger.warn('OCR processing failed, falling back to direct text extraction:', ocrError)

        // Fallback: Extract text directly from original PDF without OCR
        ocrLogger.info('Extracting text directly from original PDF...')
        content = await this.extractTextFromPdf(filePath)
        usedOcr = false
      }

      // 7. Calculate processing time
      const processingTime = Date.now() - startTime

      ocrLogger.info(
        `Processing completed in ${processingTime}ms (${usedOcr ? 'with OCR' : 'direct text extraction'})`
      )

      // 8. Create structured result
      const result: ProcessedDocument = {
        success: true,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: {
          pageCount: content.length,
          fileSize: fileStats.size,
          processingTime
        },
        content
      }

      // 9. Save to JSON
      await this.saveProcessedDocument(filePath, result)

      return result
    } catch (error) {
      ocrLogger.error('Error processing document:', error)

      return {
        success: false,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: {
          pageCount: 0,
          fileSize: 0,
          processingTime: Date.now() - startTime
        },
        content: [],
        error: error instanceof Error ? error.message : 'Unknown error processing document'
      }
    }
  }

  /**
   * Extract text from PDF file using Python script
   */
  private async extractTextFromPdf(pdfPath: string): Promise<PageContent[]> {
    try {
      ocrLogger.debug('Extracting text from PDF using Python script:', pdfPath)

      // Get the Python script path from the user's Documents folder
      // This is where copyExtractScript() copies it during venv setup
      const documentsPath = app.getPath('documents')
      const pythonFolder = path.join(documentsPath, 'Panopticon', 'panopticon-python')
      const scriptPath = path.join(pythonFolder, 'extract_pdf_text.py')

      ocrLogger.debug('Python script path:', scriptPath)

      // Check if script exists
      try {
        await access(scriptPath)
      } catch {
        throw new Error(`Python extraction script not found at: ${scriptPath}`)
      }

      // Get Python executable from venv
      const venvStatus = await pythonEnvService.checkVenvStatus()
      if (!venvStatus.exists) {
        throw new Error('Python virtual environment not found')
      }

      const pythonPath = pythonEnvService.getPythonExecutable()

      // Run the Python script
      const command = `"${pythonPath}" "${scriptPath}" "${pdfPath}"`
      ocrLogger.debug('Running command:', command)

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large PDFs
      })

      if (stderr && !stderr.includes('Warning')) {
        ocrLogger.warn('Python script stderr:', stderr)
      }

      // Parse JSON output
      const result = JSON.parse(stdout)

      if (!result.success) {
        throw new Error(result.error || 'Failed to extract text from PDF')
      }

      ocrLogger.info(`Successfully extracted text from ${result.totalPages} pages`)

      return result.pages as PageContent[]
    } catch (error) {
      ocrLogger.error('Error extracting text from PDF:', error)
      throw new Error(
        `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Process multiple documents in batch
   */
  async processDocuments(filePaths: string[]): Promise<ProcessedDocument[]> {
    const results: ProcessedDocument[] = []

    for (const filePath of filePaths) {
      try {
        const result = await this.processDocument(filePath)
        results.push(result)
      } catch (error) {
        ocrLogger.error(`Failed to process ${filePath}:`, error)
        results.push({
          success: false,
          filePath,
          fileName: path.basename(filePath),
          processingMethod: 'local',
          processedAt: new Date().toISOString(),
          metadata: {
            pageCount: 0,
            fileSize: 0,
            processingTime: 0
          },
          content: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }
}

// Export singleton instance
export const localOcrService = new LocalOcrService()
