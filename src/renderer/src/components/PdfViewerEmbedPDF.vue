<script setup lang="ts">
import { usePdfiumEngine } from '@embedpdf/engines/vue'
import { EmbedPDF } from '@embedpdf/core/vue'
import { createPluginRegistration } from '@embedpdf/core'

// Import the essential plugins and their components
import { ViewportPluginPackage, Viewport } from '@embedpdf/plugin-viewport/vue'
import { Scroller, ScrollPluginPackage, ScrollStrategy } from '@embedpdf/plugin-scroll/vue'
import { LoaderPluginPackage } from '@embedpdf/plugin-loader/vue'
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/vue'
import { TilingLayer, TilingPluginPackage } from '@embedpdf/plugin-tiling/vue'
import { InteractionManagerPluginPackage, PagePointerProvider, GlobalPointerProvider } from '@embedpdf/plugin-interaction-manager/vue'
import { SelectionPluginPackage, SelectionLayer } from '@embedpdf/plugin-selection/vue'
import { ThumbnailPluginPackage, ThumbnailsPane, ThumbImg } from '@embedpdf/plugin-thumbnail/vue'
import { ZoomMode, ZoomPluginPackage, MarqueeZoom } from '@embedpdf/plugin-zoom/vue'
import { PanPluginPackage } from '@embedpdf/plugin-pan/vue'
import { SearchPluginPackage, SearchLayer } from '@embedpdf/plugin-search/vue'
import { ZoomIn, ZoomOut, Maximize2, Search, ChevronUp, ChevronDown, X, Copy } from 'lucide-vue-next'

interface Props {
  filePath?: string
}

const props = withDefaults(defineProps<Props>(), {
  filePath: ''
})

const wasmUrl = new URL('./pdfium.wasm', import.meta.url).href

// 1. Initialize the engine with the Vue composable
const { engine, isLoading, error } = usePdfiumEngine({
  wasmUrl,
  worker: true
})

// Log engine state for debugging
console.log('[EmbedPDF] Engine loading state:', {
  isLoading: isLoading.value,
  hasEngine: !!engine.value,
  error: error?.value
})

// Watch for changes
import { watch, computed, ref, defineComponent } from 'vue'
import { useSelectionCapability, type SelectionRangeX } from '@embedpdf/plugin-selection/vue'
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import { useZoom } from '@embedpdf/plugin-zoom/vue'
import { useSearch } from '@embedpdf/plugin-search/vue'

watch([engine, isLoading, error], ([eng, loading, err]) => {
  console.log('[EmbedPDF] State changed:', { hasEngine: !!eng, isLoading: loading, error: err })
})

// Parent state for copy functionality and thumbnails
const hasSelection = ref(false)
const selectionCapability = ref<any>(null)
const scrollState = ref<any>(null)
const scrollProvides = ref<any>(null)
const zoomState = ref<any>(null)
const zoomProvides = ref<any>(null)
const searchProvides = ref<any>(null)
const searchQuery = ref('')
const showSearchBar = ref(false)

// Child component that runs inside EmbedPDF context
const PdfViewerContent = defineComponent({
  emits: ['selection-ready', 'scroll-ready', 'zoom-ready', 'search-ready'],
  setup(_, { emit }) {
    const { provides: selection } = useSelectionCapability()
    const { state: scroll, provides: scrollProv } = useScroll()
    const { state: zoom, provides: zoomProv } = useZoom()
    const { provides: search } = useSearch()
    
    const onMounted = (): void => {
      if (selection.value) {
        emit('selection-ready', selection.value)
        selection.value.onSelectionChange((sel: SelectionRangeX | null) => {
          hasSelection.value = !!sel
        })
      }
      
      if (scroll.value && scrollProv.value) {
        emit('scroll-ready', { state: scroll.value, provides: scrollProv.value })
      }
      
      if (zoom.value && zoomProv.value) {
        emit('zoom-ready', { state: zoom.value, provides: zoomProv.value })
      }
      
      if (search.value) {
        emit('search-ready', search.value)
      }
    }
    
    // Call on next tick to ensure EmbedPDF is ready
    setTimeout(onMounted, 0)
    
    return () => null
  }
})

const handleSelectionReady = (selection: any): void => {
  selectionCapability.value = selection
  
  // Listen for keyboard shortcuts
  const handleKeyboardCopy = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'c' && hasSelection.value) {
      event.preventDefault()
      selectionCapability.value?.copyToClipboard()
    }
  }
  
  window.addEventListener('keydown', handleKeyboardCopy)
}

const handleScrollReady = (data: any): void => {
  scrollState.value = data.state
  scrollProvides.value = data.provides
}

const handleZoomReady = (data: any): void => {
  zoomState.value = data.state
  zoomProvides.value = data.provides
}

const handleSearchReady = (search: any): void => {
  searchProvides.value = search
}

const copySelection = (): void => {
  selectionCapability.value?.copyToClipboard()
}

// Zoom controls
const zoomIn = (): void => {
  zoomProvides.value?.zoomIn()
}

const zoomOut = (): void => {
  zoomProvides.value?.zoomOut()
}

const resetZoom = (): void => {
  zoomProvides.value?.setZoomMode({ mode: ZoomMode.FitPage })
}

// Search controls
const toggleSearch = (): void => {
  showSearchBar.value = !showSearchBar.value
  if (!showSearchBar.value) {
    searchProvides.value?.stopSearch()
    searchQuery.value = ''
  }
}

const performSearch = (): void => {
  if (searchQuery.value.trim()) {
    searchProvides.value?.searchAllPages(searchQuery.value)
  } else {
    searchProvides.value?.stopSearch()
  }
}

const nextSearchResult = (): void => {
  searchProvides.value?.nextResult()
}

const prevSearchResult = (): void => {
  searchProvides.value?.previousResult()
}

// Convert file path to file:// URL
const pdfUrl = computed(() => {
  if (!props.filePath) return ''
  // Convert Windows path to file URL
  const normalized = props.filePath.replace(/\\/g, '/')
  return `file:///${normalized}`
})

// 2. Register the plugins you need
const plugins = computed(() => {
  if (!pdfUrl.value) return []
  
  return [
    createPluginRegistration(LoaderPluginPackage, {
      loadingOptions: {
        type: 'url',
        pdfFile: {
          id: props.filePath || 'pdf-document',
          url: pdfUrl.value
        }
      }
    }),
    createPluginRegistration(ViewportPluginPackage, {
      viewportGap: 10
    }),
    createPluginRegistration(ScrollPluginPackage, {
      strategy: ScrollStrategy.Vertical,
      pageGap: 10
    }),
    createPluginRegistration(RenderPluginPackage),
    createPluginRegistration(TilingPluginPackage, {
      tileSize: 768,
      overlapPx: 2.5,
      extraRings: 0
    }),
    createPluginRegistration(InteractionManagerPluginPackage),
    createPluginRegistration(SelectionPluginPackage),
    createPluginRegistration(ZoomPluginPackage, {
      defaultZoomLevel: ZoomMode.FitPage
    }),
    createPluginRegistration(PanPluginPackage),
    createPluginRegistration(ThumbnailPluginPackage, {
      width: 120,
      imagePadding: 10,
      labelHeight: 25
    }),
    createPluginRegistration(SearchPluginPackage, {
      flags: [],
      showAllResults: true
    }),
  ]
})
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden bg-zinc-900">
    <div v-if="!filePath" class="flex items-center justify-center h-full text-zinc-400">
      Select a PDF file to view
    </div>
    <div v-else-if="error" class="flex items-center justify-center h-full text-red-400 p-5">
      Error loading PDF engine: {{ error }}
    </div>
    <div v-else-if="isLoading || !engine" class="flex items-center justify-center h-full text-zinc-400">
      Loading PDF Engine...
    </div>

    <div v-else class="w-full h-full flex flex-col relative">
      <!-- Top toolbar with zoom and search controls -->
      <div class="flex items-center px-3 py-2 bg-zinc-800 border-b border-zinc-700 gap-4 z-[100]">
        <!-- Zoom controls -->
        <div class="flex items-center gap-1">
          <button
            @click="zoomOut"
            class="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut :size="18" />
          </button>
          <button
            @click="resetZoom"
            class="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            title="Fit to Page"
          >
            <Maximize2 :size="18" />
          </button>
          <button
            @click="zoomIn"
            class="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn :size="18" />
          </button>
          <span v-if="zoomState" class="text-sm text-zinc-300 px-2 min-w-[50px]">
            {{ Math.round(zoomState.zoomLevel * 100) }}%
          </span>
        </div>
        
        <!-- Search controls -->
        <div class="flex items-center gap-1">
          <button
            @click="toggleSearch"
            class="p-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            :class="{ 'bg-blue-600 hover:bg-blue-500': showSearchBar }"
            title="Search"
          >
            <Search :size="18" />
          </button>
        </div>
      </div>

      <!-- Search bar -->
      <div v-if="showSearchBar" class="flex items-center px-3 py-2 bg-zinc-800 border-b border-zinc-700 gap-2 z-[100]">
        <input
          v-model="searchQuery"
          @keyup.enter="performSearch"
          type="text"
          placeholder="Search in document..."
          class="flex-1 px-3 py-1.5 bg-zinc-700 text-white border border-zinc-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <button @click="performSearch" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors">
          Search
        </button>
        <button @click="prevSearchResult" class="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors" title="Previous">
          <ChevronUp :size="18" />
        </button>
        <button @click="nextSearchResult" class="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors" title="Next">
          <ChevronDown :size="18" />
        </button>
        <button @click="toggleSearch" class="p-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors" title="Close">
          <X :size="18" />
        </button>
      </div>

      <!-- Copy button toolbar -->
      <div v-if="hasSelection" class="absolute top-2 right-2 z-[1000]">
        <button @click="copySelection" class="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg transition-colors">
          <Copy :size="16" />
          Copy (Ctrl+C)
        </button>
      </div>

      <EmbedPDF :engine="engine" :plugins="plugins">
        <PdfViewerContent 
          @selection-ready="handleSelectionReady" 
          @scroll-ready="handleScrollReady"
          @zoom-ready="handleZoomReady"
          @search-ready="handleSearchReady"
        />
        
        <div class="flex w-full h-full overflow-hidden">
          <!-- Thumbnails sidebar -->
          <div class="w-[150px] min-w-[150px] h-full overflow-y-auto bg-zinc-800 border-r border-zinc-700 relative">
            <ThumbnailsPane>
              <template #default="{ meta }">
                <div
                  :key="meta.pageIndex"
                  :style="{
                    position: 'absolute',
                    top: `${meta.top}px`,
                    height: `${meta.wrapperHeight}px`,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px 0',
                    cursor: 'pointer'
                  }"
                  @click="scrollProvides?.scrollToPage({ pageNumber: meta.pageIndex + 1 })"
                >
                  <div
                    :style="{
                      border: `2px solid ${scrollState?.currentPage === meta.pageIndex + 1 ? '#3b82f6' : '#52525b'}`,
                      width: `${meta.width}px`,
                      height: `${meta.height}px`,
                      boxShadow: scrollState?.currentPage === meta.pageIndex + 1 ? '0 0 8px rgba(59, 130, 246, 0.5)' : 'none',
                      transition: 'all 0.2s'
                    }"
                  >
                    <ThumbImg :meta="meta" />
                  </div>
                  <span
                    :style="{
                      height: `${meta.labelHeight}px`,
                      fontSize: '12px',
                      color: scrollState?.currentPage === meta.pageIndex + 1 ? '#3b82f6' : '#a1a1aa',
                      marginTop: '4px'
                    }"
                  >
                    {{ meta.pageIndex + 1 }}
                  </span>
                </div>
              </template>
            </ThumbnailsPane>
          </div>
          
          <!-- Main PDF viewer -->
          <div class="flex-1 h-full overflow-hidden">
            <GlobalPointerProvider>
              <Viewport class="w-full h-full bg-zinc-900 overflow-auto pdf-viewport" @dragstart.prevent>
                <Scroller>
                  <template #default="{ page }">
                    <PagePointerProvider
                      :page-index="page.pageIndex"
                      :page-width="page.width"
                      :page-height="page.height"
                      :rotation="page.rotation"
                      :scale="page.scale"
                    >
                      <RenderLayer :page-index="page.pageIndex" style="pointer-events: none" />
                      <TilingLayer :page-index="page.pageIndex" :scale="page.scale" style="pointer-events: none" />
                      <MarqueeZoom :page-index="page.pageIndex" :scale="page.scale" />
                      <SearchLayer :page-index="page.pageIndex" :scale="page.scale" />
                      <SelectionLayer :page-index="page.pageIndex" :scale="page.scale" />
                    </PagePointerProvider>
                  </template>
                </Scroller>
              </Viewport>
            </GlobalPointerProvider>
          </div>
        </div>
    </EmbedPDF>
    </div>
  </div>
</template>

<style scoped>
/* Custom styles for PDF viewer - using Tailwind where possible */
.pdf-viewport {
  user-select: text;
  -webkit-user-drag: none;
}

.pdf-viewport :deep(img),
.pdf-viewport :deep(canvas) {
  user-drag: none;
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
</style>
