import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { viewLogger } from '@/utils/logger'

/**
 * Module-level state for PDF viewer functionality.
 *
 * @remarks
 * This composable uses a singleton pattern with module-level refs to maintain
 * shared PDF viewer state across all components (Base.vue, Library.vue, Bookmarks.vue).
 *
 * The singleton pattern allows:
 * - Consistent PDF viewer state when switching between views
 * - A single PDF panel that can be opened from multiple locations
 * - Tracking which view "owns" the current PDF session
 *
 * Lifecycle considerations:
 * - State persists across component mount/unmount cycles
 * - Each view tracks its last known page for return navigation
 * - Panel width and resize state are preserved globally
 */
const selectedPdfPath = ref<string | undefined>(undefined)
const selectedPdfPage = ref<number>(1)
const isPdfViewerOpen = ref(false)
const pdfViewerSource = ref<string | undefined>(undefined) // Track which view owns the PDF viewer
const pdfPanelWidth = ref(66.67) // Width as percentage (2/3 of the view)
const isResizing = ref(false)
const lastKnownPages = ref<Record<string, number>>({}) // Track last known page for each view

// Resizer limits (in percentage)
const MIN_PDF_WIDTH = 30
const MAX_PDF_WIDTH = 80

export function usePdfViewer(viewSource?: string): {
  selectedPdfPath: Ref<string | undefined>
  selectedPdfPage: Ref<number>
  isPdfViewerOpen: Ref<boolean>
  isOwnPdfViewer: ComputedRef<boolean>
  pdfPanelWidth: Ref<number>
  isResizing: Ref<boolean>
  searchPanelWidth: ComputedRef<number>
  MIN_PDF_WIDTH: number
  MAX_PDF_WIDTH: number
  openPdf: (filePath: string, pageNumber?: number) => void
  closePdfViewer: () => void
  startResize: (e: MouseEvent) => void
  updateLastKnownPage: (pageNumber: number) => void
  getLastKnownPage: () => number | undefined
} {
  const openPdf = (filePath: string, pageNumber: number = 1): void => {
    selectedPdfPath.value = filePath
    selectedPdfPage.value = pageNumber
    isPdfViewerOpen.value = true
    if (viewSource) {
      pdfViewerSource.value = viewSource
    }
  }

  const closePdfViewer = (): void => {
    isPdfViewerOpen.value = false
    selectedPdfPath.value = undefined
    selectedPdfPage.value = 1
    pdfViewerSource.value = undefined
  }

  const updateLastKnownPage = (pageNumber: number): void => {
    if (viewSource) {
      lastKnownPages.value[viewSource] = pageNumber
      viewLogger.debug(`[usePdfViewer] Updated ${viewSource} last known page:`, pageNumber)
    }
  }

  const getLastKnownPage = (): number | undefined => {
    return viewSource ? lastKnownPages.value[viewSource] : undefined
  }

  // Check if this view owns the PDF viewer
  const isOwnPdfViewer = computed(() => {
    return isPdfViewerOpen.value && pdfViewerSource.value === viewSource
  })

  const startResize = (e: MouseEvent): void => {
    isResizing.value = true
    e.preventDefault()

    // Prevent text selection during resize
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      if (!isResizing.value) return

      const containerWidth = window.innerWidth
      const newPdfWidth = ((containerWidth - moveEvent.clientX) / containerWidth) * 100

      // Clamp the width between min and max
      if (newPdfWidth >= MIN_PDF_WIDTH && newPdfWidth <= MAX_PDF_WIDTH) {
        pdfPanelWidth.value = newPdfWidth
      }
    }

    const handleMouseUp = (): void => {
      isResizing.value = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const searchPanelWidth = computed(() => {
    // Only adjust width if this view owns the PDF viewer
    if (!isOwnPdfViewer.value) return 100
    return 100 - pdfPanelWidth.value
  })

  return {
    // State
    selectedPdfPath,
    selectedPdfPage,
    isPdfViewerOpen,
    isOwnPdfViewer,
    pdfPanelWidth,
    isResizing,
    searchPanelWidth,
    MIN_PDF_WIDTH,
    MAX_PDF_WIDTH,

    // Methods
    openPdf,
    closePdfViewer,
    startResize,
    updateLastKnownPage,
    getLastKnownPage
  }
}
