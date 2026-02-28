import { localOcrService, ProcessedDocument } from './localOcrService'
import { logger as ocrLogger } from '../utils/logger'
import * as path from 'path'

export type { ProcessedDocument, PageContent } from './localOcrService'

class DocumentProcessingService {
  /**
   * Process a single document using local OCR
   */
  async processDocument(
    filePath: string,
    options: Record<string, unknown> = {}
  ): Promise<ProcessedDocument> {
    void options // Reserved for future use
    ocrLogger.info('Processing document with local mode:', filePath)

    return await this.processWithLocal(filePath)
  }

  /**
   * Process multiple documents in batch
   */
  async processDocuments(
    filePaths: string[],
    options: Record<string, unknown> = {}
  ): Promise<ProcessedDocument[]> {
    void options // Reserved for future use
    ocrLogger.info(`Processing ${filePaths.length} documents with local mode`)

    const results: ProcessedDocument[] = []

    for (const filePath of filePaths) {
      try {
        const result = await this.processDocument(filePath, options)
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

  /**
   * Process document using local OCR
   */
  private async processWithLocal(filePath: string): Promise<ProcessedDocument> {
    try {
      // Check if environment is ready
      const readyCheck = await localOcrService.isReady()
      if (!readyCheck.ready) {
        throw new Error(readyCheck.error)
      }

      return await localOcrService.processDocument(filePath)
    } catch (error) {
      ocrLogger.error('Local processing failed:', error)
      throw error
    }
  }

  /**
   * Check if local processing is available
   */
  async isLocalProcessingAvailable(): Promise<{ available: boolean; error?: string }> {
    const status = await localOcrService.isReady()
    return {
      available: status.ready,
      error: status.error
    }
  }
}

// Export singleton instance
export const documentProcessingService = new DocumentProcessingService()
