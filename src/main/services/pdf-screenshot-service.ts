import { BrowserWindow } from 'electron'
import * as path from 'path'
import { ocrLogger } from '../utils/logger'

/** Width × height in pixels for an A4 page at 150 DPI. */
const PAGE_WIDTH = 1240
const PAGE_HEIGHT = 1754

/** Extra milliseconds to wait after the `did-finish-load` event so Chromium's
 *  built-in PDF renderer has time to paint the first page. */
const PAINT_SETTLE_MS = 1500

/**
 * Captures a single PDF page as a PNG buffer by loading the file in a hidden
 * Electron BrowserWindow and using Chromium's native PDF renderer.
 *
 * @remarks
 * This is intentionally a thin utility — it creates a new window per call so
 * that each capture starts from a clean state.  For the OCR fallback path the
 * number of scanned pages is usually small, so the overhead is acceptable.
 */
class PdfScreenshotService {
  /**
   * Render `pageNumber` (1-based) of the given PDF and return the result as a
   * PNG `Buffer` that can be fed directly to `tesseract.js`.
   */
  async capturePageAsPng(filePath: string, pageNumber: number): Promise<Buffer> {
    ocrLogger.debug(`Capturing PDF page ${pageNumber} as PNG: ${path.basename(filePath)}`)

    const win = new BrowserWindow({
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      show: false,
      webPreferences: {
        // Note: webSecurity cannot be disabled here for security reasons.
        // Local file:// URLs for PDF rendering are loaded via chrome's built-in
        // PDF renderer which works without relaxed security on most platforms.
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    try {
      await this._loadPage(win, filePath, pageNumber)

      // Give the PDF plugin a moment to fully paint.
      await this._sleep(PAINT_SETTLE_MS)

      const image = await win.webContents.capturePage()
      const png = image.toPNG()

      ocrLogger.debug(`Captured page ${pageNumber} — ${Math.round(png.byteLength / 1024)} KB`)

      return Buffer.from(png)
    } finally {
      // Always close and destroy the window to prevent handle leaks.
      if (!win.isDestroyed()) {
        win.close()
        win.destroy()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _loadPage(win: BrowserWindow, filePath: string, pageNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Timeout after 30 seconds to prevent indefinite hangs
      const timeout = setTimeout(() => {
        reject(new Error(`PDF page ${pageNumber} load timeout after 30s`))
      }, 30000)

      win.webContents.once('did-fail-load', (_event, _errCode, errDesc) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to load PDF page ${pageNumber}: ${errDesc}`))
      })

      win.webContents.once('did-finish-load', () => {
        clearTimeout(timeout)
        resolve()
      })

      // Chromium's built-in PDF viewer accepts a `#page=N` fragment (1-based).
      // Normalise path separators for the file:// URL on Windows.
      const normalised = filePath.replace(/\\/g, '/')
      const url = `file:///${normalised}#page=${pageNumber}`
      win.loadURL(url)
    })
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/** Singleton instance. */
export const pdfScreenshotService = new PdfScreenshotService()
