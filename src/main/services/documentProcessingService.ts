import { tesseractOcrService, ProcessedDocument } from './tesseract-ocr-service'
import { textProcessingService } from './textProcessingService'
import { ocrLogger } from '../utils/logger'
import * as path from 'path'

export type { ProcessedDocument, PageContent } from './tesseract-ocr-service'

/** File extensions handled by the text processing service. */
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

/**
 * Thin orchestrator for document processing.
 * Dispatches to {@link textProcessingService} for Markdown/plain-text files
 * and to {@link tesseractOcrService} for PDFs.
 */
class DocumentProcessingService {
  /**
   * Process a single document.
   * Dispatches by file extension: `.md` / `.markdown` / `.txt` go to the
   * text-processing service; everything else is treated as a PDF.
   */
  async processDocument(
    filePath: string,
    options: Record<string, unknown> = {}
  ): Promise<ProcessedDocument> {
    void options
    ocrLogger.info('Processing document:', filePath)
    const ext = path.extname(filePath).toLowerCase()
    if (TEXT_EXTENSIONS.has(ext)) {
      return await textProcessingService.processTextFile(filePath)
    }
    return await tesseractOcrService.processDocument(filePath)
  }

  /**
   * Process multiple documents in batch.
   */
  async processDocuments(
    filePaths: string[],
    options: Record<string, unknown> = {}
  ): Promise<ProcessedDocument[]> {
    void options
    ocrLogger.info(`Processing ${filePaths.length} documents`)

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
          metadata: { pageCount: 0, fileSize: 0, mtime: '', processingTime: 0 },
          content: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return results
  }

  /**
   * Check if local processing is available.
   * Always true — tesseract.js has no external dependencies.
   */
  async isLocalProcessingAvailable(): Promise<{ available: boolean; error?: string }> {
    const status = await tesseractOcrService.isReady()
    return { available: status.ready, error: status.error }
  }
}

/** Singleton instance */
export const documentProcessingService = new DocumentProcessingService()
