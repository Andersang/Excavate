import * as path from 'path'
import { access, stat, readFile, open, mkdir, writeFile } from 'fs/promises'
import { createWorker, Worker } from 'tesseract.js'
import { PDFParse } from 'pdf-parse'
import { pdfScreenshotService } from './pdf-screenshot-service'
import { ocrLogger } from '../utils/logger'

/** Pages with fewer characters than this threshold are treated as image-only
 *  and will be sent through the screenshot → tesseract OCR fallback. */
const MIN_TEXT_CHARS = 20

/**
 * Content extracted from a single PDF page.
 */
export interface PageContent {
  pageNumber: number
  content: string
}

/**
 * Full result of processing a PDF document.
 * This interface is intentionally identical to the legacy `localOcrService`
 * contract so the rest of the application needs zero changes.
 */
export interface ProcessedDocument {
  success: boolean
  filePath: string
  fileName: string
  processingMethod: 'local'
  processedAt: string
  metadata: {
    pageCount: number
    fileSize: number
    mtime: string // ISO-8601 mtime of the source file at processing time
    processingTime: number // milliseconds
  }
  content: PageContent[]
  error?: string
}

/**
 * Service that extracts text from PDF documents.
 *
 * Strategy:
 *  1. Use `pdf-parse` v2 (`PDFParse.getText()`) to obtain native text for every page.
 *  2. For pages that yield too few characters (scanned / image-only), fall back
 *     to taking a screenshot via Electron's Chromium PDF renderer and running
 *     tesseract.js OCR on the captured image.
 *
 * @remarks
 * Replaces the former pipeline that relied on `@embedpdf/engines` (PDFium WASM)
 * to render pages to PNG before passing them to tesseract.  The WASM binary has
 * a fixed memory ceiling that caused `RuntimeError: memory access out of bounds`
 * when rendering large pages at high DPI.
 */
class TesseractOcrService {
  private _worker: Worker | undefined = undefined
  private _workerPromise: Promise<void> | undefined = undefined

  /**
   * Always returns ready — no external dependencies needed.
   */
  async isReady(): Promise<{ ready: boolean; error?: string }> {
    return { ready: true }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Process a single PDF document.
   *
   * Returns a `ProcessedDocument` with per-page content, caching the result
   * as JSON alongside the source file on first run.
   */
  async processDocument(filePath: string): Promise<ProcessedDocument> {
    const startTime = Date.now()
    const fileName = path.basename(filePath)

    try {
      await access(filePath)
      const fileStats = await stat(filePath)

      if (!(await this._isPdf(filePath))) {
        throw new Error('File is not a PDF. Only PDF files are currently supported.')
      }

      ocrLogger.info('Processing PDF:', filePath)

      // Return cached result if available.
      if (await this._isAlreadyProcessed(filePath)) {
        ocrLogger.info('Document already processed, loading from cache…')
        const jsonPath = this._getProcessedJsonPath(filePath)
        const cached = await readFile(jsonPath, 'utf-8')
        return JSON.parse(cached) as ProcessedDocument
      }

      // --- Step 1: extract per-page text via pdf-parse v2 --------------------
      const pdfBuffer = await readFile(filePath)
      const parser = new PDFParse({ data: pdfBuffer })

      let textResult: Awaited<ReturnType<PDFParse['getText']>>
      try {
        textResult = await parser.getText()
      } finally {
        await parser.destroy()
      }

      const pageCount = textResult.total

      // --- Step 2: OCR fallback for image-only pages -------------------------
      const content: PageContent[] = []

      for (const page of textResult.pages) {
        const pageNumber = page.num
        const nativeText = page.text.trim()

        if (nativeText.length >= MIN_TEXT_CHARS) {
          // Native text is good — use it directly.
          ocrLogger.debug(`Page ${pageNumber}: native text (${nativeText.length} chars)`)
          content.push({ pageNumber, content: nativeText })
        } else {
          // Image-only or very sparse page — fall back to screenshot OCR.
          ocrLogger.debug(
            `Page ${pageNumber}: sparse text (${nativeText.length} chars), running OCR…`
          )
          const ocrText = await this._ocrPage(filePath, pageNumber)
          content.push({ pageNumber, content: ocrText })
        }
      }

      const processingTime = Date.now() - startTime
      ocrLogger.info(`Processing completed in ${processingTime}ms (${pageCount} pages)`)

      const result: ProcessedDocument = {
        success: true,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: {
          pageCount,
          fileSize: fileStats.size,
          mtime: fileStats.mtime.toISOString(),
          processingTime
        },
        content
      }

      await this._saveProcessedDocument(filePath, result)
      return result
    } catch (error) {
      ocrLogger.error('Error processing document:', error)

      return {
        success: false,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: { pageCount: 0, fileSize: 0, mtime: '', processingTime: Date.now() - startTime },
        content: [],
        error: error instanceof Error ? error.message : 'Unknown error processing document'
      }
    }
  }

  /**
   * Process multiple PDF documents sequentially.
   * Individual failures do not abort the batch.
   */
  async processDocuments(filePaths: string[]): Promise<ProcessedDocument[]> {
    const results: ProcessedDocument[] = []

    for (const filePath of filePaths) {
      try {
        results.push(await this.processDocument(filePath))
      } catch (error) {
        ocrLogger.error(`Failed to process ${filePath}:`, error)
        results.push({
          success: false,
          filePath,
          fileName: path.basename(filePath),
          processingMethod: 'local',
          processedAt: new Date().toISOString(),
          metadata: { pageCount: 0, fileSize: 0, mtime: '', processingTime: 0 },
          content: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * Terminate the tesseract worker and release resources.
   * Call on app shutdown.
   */
  async dispose(): Promise<void> {
    if (this._worker) {
      await this._worker.terminate()
      this._worker = undefined
      this._workerPromise = undefined
      ocrLogger.info('Tesseract.js worker terminated')
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Capture a PDF page as PNG via the Electron PDF renderer, then OCR it. */
  private async _ocrPage(filePath: string, pageNumber: number): Promise<string> {
    const worker = await this._ensureWorker()
    const png = await pdfScreenshotService.capturePageAsPng(filePath, pageNumber)
    const { data } = await worker.recognize(png)
    return data.text.trim()
  }

  /** Lazily initialise the tesseract.js worker. */
  private async _ensureWorker(): Promise<Worker> {
    if (this._worker) return this._worker
    if (this._workerPromise) {
      await this._workerPromise
      return this._worker!
    }
    this._workerPromise = this._initWorker()
    await this._workerPromise
    return this._worker!
  }

  private async _initWorker(): Promise<void> {
    ocrLogger.info('Initializing tesseract.js worker…')
    this._worker = await createWorker('eng', undefined, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          ocrLogger.debug(`Tesseract: ${m.status} (${Math.round((m.progress ?? 0) * 100)}%)`)
        }
      }
    })
    ocrLogger.info('Tesseract.js worker initialised (English)')
  }

  /** Read the first 4 bytes and verify the `%PDF` magic number. */
  private async _isPdf(filePath: string): Promise<boolean> {
    try {
      const fd = await open(filePath, 'r')
      const buffer = Buffer.alloc(4)
      await fd.read(buffer, 0, 4, 0)
      await fd.close()
      return buffer.toString('ascii', 0, 4) === '%PDF'
    } catch (error) {
      ocrLogger.error('Error checking file type:', error)
      return false
    }
  }

  private _getProcessedJsonPath(filePath: string): string {
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath, path.extname(filePath))
    return path.join(dir, 'panopticon-processed', `${fileName}-processed.json`)
  }

  private async _isAlreadyProcessed(filePath: string): Promise<boolean> {
    const jsonPath = this._getProcessedJsonPath(filePath)
    try {
      await access(jsonPath)
    } catch {
      return false
    }

    // Validate that the cached result still matches the source file.
    try {
      const [jsonContent, fileStats] = await Promise.all([
        readFile(jsonPath, 'utf-8'),
        stat(filePath)
      ])
      const cached = JSON.parse(jsonContent) as ProcessedDocument
      const cachedMtime = cached.metadata?.mtime
      const cachedSize = cached.metadata?.fileSize
      if (cachedMtime !== fileStats.mtime.toISOString() || cachedSize !== fileStats.size) {
        ocrLogger.info(
          'Source file changed since last processing, cache invalidated:',
          path.basename(filePath)
        )
        return false
      }
      return true
    } catch {
      // If we can’t read or parse the cache, reprocess.
      return false
    }
  }

  private async _saveProcessedDocument(
    filePath: string,
    document: ProcessedDocument
  ): Promise<void> {
    const jsonPath = this._getProcessedJsonPath(filePath)
    const jsonDir = path.dirname(jsonPath)
    await mkdir(jsonDir, { recursive: true })
    await writeFile(jsonPath, JSON.stringify(document, null, 2), 'utf-8')
    ocrLogger.info('Processed document saved to:', jsonPath)
  }
}

/** Singleton instance */
export const tesseractOcrService = new TesseractOcrService()
