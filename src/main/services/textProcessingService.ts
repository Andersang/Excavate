import * as path from 'path'
import { access, readFile, stat, mkdir, writeFile } from 'fs/promises'
import { marked, type Token } from 'marked'
import type { ProcessedDocument, PageContent } from './tesseract-ocr-service'
import { ocrLogger } from '../utils/logger'

// ---------------------------------------------------------------------------
// Chunking constants — tuned for FlexSearch recall and future vector embeddings
// ---------------------------------------------------------------------------

/** Target chunk size in words. Stays ≈ 350–450 tokens — the known optimum for
 *  dense-vector retrieval while remaining manageable for keyword indexing. */
const TARGET_WORDS = 300

/** Overlap in words carried from the end of the previous chunk into the next.
 *  Kept at sentence boundaries so phrases that span a split remain findable. */
const OVERLAP_WORDS = 50

// ---------------------------------------------------------------------------
// Markdown → plain text extraction
// ---------------------------------------------------------------------------

/**
 * Walk a `marked` token tree and collect human-readable text.
 * Returns an array of `{ level, text }` objects where `level` is 0 for body
 * text and 1–6 for headings, preserving structural order.
 */
function _walkTokens(tokens: Token[]): Array<{ level: number; text: string }> {
  const parts: Array<{ level: number; text: string }> = []

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        parts.push({ level: token.depth, text: token.text.trim() })
        break

      case 'paragraph':
        parts.push({ level: 0, text: token.text.trim() })
        break

      case 'blockquote':
        if ('tokens' in token && token.tokens) {
          parts.push(..._walkTokens(token.tokens))
        }
        break

      case 'list':
        if ('items' in token && token.items) {
          for (const item of token.items) {
            if ('tokens' in item && item.tokens) {
              const sub = _walkTokens(item.tokens)
              parts.push(...sub)
            } else if ('text' in item) {
              parts.push({ level: 0, text: (item.text as string).trim() })
            }
          }
        }
        break

      case 'code':
        // Include code blocks as plain text so code search works
        parts.push({ level: 0, text: token.text.trim() })
        break

      case 'table':
        if ('header' in token && token.header) {
          const headers = (token.header as Array<{ text: string }>).map((h) => h.text).join(' | ')
          parts.push({ level: 0, text: headers })
        }
        if ('rows' in token && token.rows) {
          for (const row of token.rows as Array<Array<{ text: string }>>) {
            parts.push({ level: 0, text: row.map((c) => c.text).join(' | ') })
          }
        }
        break

      case 'space':
        // Nothing to add
        break

      default:
        // Fallback: if the token has a `text` property, include it
        if ('text' in token && typeof token.text === 'string' && token.text.trim()) {
          parts.push({ level: 0, text: token.text.trim() })
        }
    }
  }

  return parts
}

// ---------------------------------------------------------------------------
// Structural chunking
// ---------------------------------------------------------------------------

/** Split plain text into sentences using punctuation boundaries. */
function _splitSentences(text: string): string[] {
  // Split after . ! ? followed by whitespace; keep the delimiter attached to its sentence.
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Count words (whitespace-delimited tokens) in a string. */
function _wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Take the last `n` words from a string (for overlap). */
function _lastNWords(text: string, n: number): string {
  const words = text.split(/\s+/).filter(Boolean)
  return words.slice(-n).join(' ')
}

/**
 * Chunk an array of `{ level, text }` parts into `PageContent[]` entries.
 *
 * Strategy (structural-first, size-limited):
 *  1. Accumulate parts up to TARGET_WORDS.
 *  2. Respect section boundaries (heading tokens flush the accumulator).
 *  3. When a single paragraph exceeds TARGET_WORDS, split at sentence
 *     boundaries and carry OVERLAP_WORDS of overlap into the next chunk.
 *  4. Each emitted chunk is prefixed with the most recent heading for context.
 */
function _chunkParts(parts: Array<{ level: number; text: string }>): PageContent[] {
  const chunks: PageContent[] = []
  let currentWords: string[] = []
  let currentHeading = ''
  let previousTailForOverlap = ''

  const flushChunk = (): void => {
    if (currentWords.length === 0) return
    const prefix = currentHeading ? `[Section: ${currentHeading}]\n` : ''
    const body = previousTailForOverlap
      ? previousTailForOverlap + ' ' + currentWords.join(' ')
      : currentWords.join(' ')
    chunks.push({
      pageNumber: chunks.length + 1,
      content: (prefix + body).trim()
    })
    // Capture tail for next chunk's overlap
    previousTailForOverlap = _lastNWords(currentWords.join(' '), OVERLAP_WORDS)
    currentWords = []
  }

  for (const part of parts) {
    if (part.level > 0) {
      // Heading — flush current accumulator, update context
      flushChunk()
      previousTailForOverlap = '' // Don't bleed content across section boundaries
      currentHeading = part.text
      continue
    }

    const partWordCount = _wordCount(part.text)

    if (
      currentWords.length > 0 &&
      _wordCount(currentWords.join(' ')) + partWordCount > TARGET_WORDS
    ) {
      // Adding this paragraph would exceed the target — flush first
      flushChunk()
    }

    if (partWordCount <= TARGET_WORDS) {
      // Whole paragraph fits — accumulate it
      currentWords.push(part.text)
    } else {
      // Paragraph is large — split at sentence boundaries
      const sentences = _splitSentences(part.text)
      let sentenceBuffer: string[] = []

      for (const sentence of sentences) {
        const bufferWordCount = _wordCount(sentenceBuffer.join(' '))
        const sentenceWordCount = _wordCount(sentence)

        if (bufferWordCount + sentenceWordCount > TARGET_WORDS && sentenceBuffer.length > 0) {
          // Emit the buffered sentences as a chunk, then start fresh with overlap
          currentWords.push(...sentenceBuffer)
          flushChunk()
          sentenceBuffer = [sentence]
        } else {
          sentenceBuffer.push(sentence)
        }
      }

      // Flush any remaining sentences
      if (sentenceBuffer.length > 0) {
        currentWords.push(...sentenceBuffer)
      }
    }
  }

  flushChunk()
  return chunks
}

// ---------------------------------------------------------------------------
// Cache helpers (same contract as tesseract-ocr-service.ts)
// ---------------------------------------------------------------------------

function _getProcessedJsonPath(filePath: string): string {
  const dir = path.dirname(filePath)
  const baseName = path.basename(filePath, path.extname(filePath))
  return path.join(dir, 'Excavate-processed', `${baseName}-processed.json`)
}

async function _isAlreadyProcessed(filePath: string): Promise<ProcessedDocument | null> {
  const jsonPath = _getProcessedJsonPath(filePath)

  try {
    await access(jsonPath)
  } catch {
    return null
  }

  try {
    const [jsonContent, fileStats] = await Promise.all([
      readFile(jsonPath, 'utf-8'),
      stat(filePath)
    ])
    const cached = JSON.parse(jsonContent) as ProcessedDocument
    const cachedMtime = cached.metadata?.mtime
    const cachedSize = cached.metadata?.fileSize

    if (cachedMtime !== fileStats.mtime.toISOString() || cachedSize !== fileStats.size) {
      ocrLogger.info('Source file changed, cache invalidated:', path.basename(filePath))
      return null
    }

    return cached
  } catch {
    return null
  }
}

async function _saveProcessedDocument(filePath: string, doc: ProcessedDocument): Promise<void> {
  const jsonPath = _getProcessedJsonPath(filePath)
  await mkdir(path.dirname(jsonPath), { recursive: true })
  await writeFile(jsonPath, JSON.stringify(doc, null, 2), 'utf-8')
  ocrLogger.info('Text document processed and saved to:', jsonPath)
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class TextProcessingService {
  /**
   * Process a Markdown or plain-text file.
   *
   * Extracts text, splits into semantically coherent ~{@link TARGET_WORDS}-word
   * chunks with {@link OVERLAP_WORDS}-word sentence-boundary overlap, and writes
   * the same `ProcessedDocument` JSON shape used by `tesseractOcrService`.
   *
   * Results are cached alongside the source file and invalidated when `mtime`
   * or `fileSize` changes.
   */
  async processTextFile(filePath: string): Promise<ProcessedDocument> {
    const startTime = Date.now()
    const fileName = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()

    try {
      await access(filePath)
      const fileStats = await stat(filePath)

      // Cache check
      const cached = await _isAlreadyProcessed(filePath)
      if (cached) {
        ocrLogger.info('Text document already processed, loading from cache:', fileName)
        return cached
      }

      ocrLogger.info(`Processing text file (${ext}):`, filePath)

      const rawText = await readFile(filePath, 'utf-8')

      let parts: Array<{ level: number; text: string }>

      if (ext === '.md' || ext === '.markdown') {
        const tokens = marked.lexer(rawText)
        parts = _walkTokens(tokens)
      } else {
        // Plain text: split on double newlines as paragraph boundaries
        const paragraphs = rawText
          .split(/\n{2,}/)
          .map((p) => p.replace(/\n/g, ' ').trim())
          .filter(Boolean)
        parts = paragraphs.map((p) => ({ level: 0, text: p }))
      }

      const content = _chunkParts(parts)

      const processingTime = Date.now() - startTime
      ocrLogger.info(`Text processing completed in ${processingTime}ms (${content.length} chunks)`)

      const result: ProcessedDocument = {
        success: true,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: {
          pageCount: content.length,
          fileSize: fileStats.size,
          mtime: fileStats.mtime.toISOString(),
          processingTime
        },
        content
      }

      await _saveProcessedDocument(filePath, result)
      return result
    } catch (error) {
      ocrLogger.error('Error processing text file:', error)

      return {
        success: false,
        filePath,
        fileName,
        processingMethod: 'local',
        processedAt: new Date().toISOString(),
        metadata: { pageCount: 0, fileSize: 0, mtime: '', processingTime: Date.now() - startTime },
        content: [],
        error: error instanceof Error ? error.message : 'Unknown error processing text file'
      }
    }
  }
}

/** Singleton instance */
export const textProcessingService = new TextProcessingService()
