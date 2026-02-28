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
import { ThumbnailPluginPackage } from '@embedpdf/plugin-thumbnail/vue'
import { ZoomMode, ZoomPluginPackage, MarqueeZoom } from '@embedpdf/plugin-zoom/vue'
import { PanPluginPackage } from '@embedpdf/plugin-pan/vue'
import { SearchPluginPackage, SearchLayer } from '@embedpdf/plugin-search/vue'
import { Search as SearchIcon, Sidebar as SidebarIcon, Loader2, X } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import { usePdfViewer } from '@/composables/usePdfViewer'

import Sidebar from './Sidebar.vue'
import Search from './Search.vue'
import ZoomControlsSimple from './ZoomControlsSimple.vue'
import CopyButton from './CopyButton.vue'
import PageIndicator from './PageIndicator.vue'
import BookmarkButton from './BookmarkButton.vue'
import PageStateTracker from './PageStateTracker.vue'
import ScrollToPage from './ScrollToPage.vue'

interface Props {
  filePath?: string
  initialPage?: number
  viewSource?: string
}

const props = withDefaults(defineProps<Props>(), {
  filePath: ''
})

const wasmUrl = new URL('./pdfium.wasm', import.meta.url).href

// Get PDF viewer controls
const { closePdfViewer } = usePdfViewer(props.viewSource)

// 1. Initialize the engine with the Vue composable
const { engine, isLoading, error } = usePdfiumEngine({
  wasmUrl,
  worker: true
})

// Drawer states
const showSidebar = ref(true)
const showSearch = ref(false)

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
      width: 150,
      imagePadding: 10,
      labelHeight: 30
    }),
    createPluginRegistration(SearchPluginPackage, {
      flags: [],
      showAllResults: true
    })
  ]
})

const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
}

const toggleSearch = () => {
  showSearch.value = !showSearch.value
}
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden bg-background">
    <div v-if="!filePath" class="flex items-center justify-center h-full text-muted-foreground">
      Select a PDF file to view
    </div>
    <div v-else-if="error" class="flex items-center justify-center h-full text-destructive p-5">
      Error loading PDF engine: {{ error }}
    </div>
    <div v-else-if="isLoading || !engine" class="flex items-center justify-center h-full text-muted-foreground">
      <Loader2 :size="48" class="animate-spin" />
    </div>

    <div v-else class="w-full h-full flex flex-col relative">
      <EmbedPDF :engine="engine" :plugins="plugins">
        <!-- Top toolbar with zoom and search controls -->
        <div class="flex items-center justify-between px-3 py-2 bg-accent border-b border-border">
          <!-- Left group: Sidebar, Zoom, Copy -->
          <div class="flex items-center gap-2">
            <button
              title="Toggle Sidebar"
              class="p-2 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
              :class="{ 'bg-primary hover:bg-primary/90 text-primary-foreground': showSidebar }"
              @click="toggleSidebar"
            >
              <SidebarIcon :size="18" />
            </button>
            
            <ZoomControlsSimple />
            
            <CopyButton />
          </div>
          
          <!-- Center: Page indicator -->
          <PageIndicator />
          
          <!-- Right: Bookmark + Search + Close -->
          <div class="flex items-center gap-2">
            <BookmarkButton :file-path="props.filePath" />
            <button
              title="Search"
              class="p-2 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
              :class="{ 'bg-primary hover:bg-primary/90 text-primary-foreground': showSearch }"
              @click="toggleSearch"
            >
              <SearchIcon :size="18" />
            </button>
            <button
              title="Close PDF"
              class="p-2 bg-muted hover:bg-destructive text-foreground hover:text-destructive-foreground rounded transition-colors"
              @click="closePdfViewer"
            >
              <X :size="18" />
            </button>
          </div>
        </div>

        <div class="flex w-full h-full overflow-hidden">
          <!-- Left Sidebar (Thumbnails) -->
          <div v-if="showSidebar" class="w-[200px] min-w-[200px] h-full border-r border-border bg-background">
            <Sidebar />
          </div>
          
          <!-- Main PDF viewer -->
          <div class="flex-1 h-full overflow-hidden relative">
            <GlobalPointerProvider>
              <PageStateTracker :view-source="props.viewSource" />
              <ScrollToPage :target-page="props.initialPage" />
              <Viewport class="w-full h-full bg-background overflow-auto pdf-viewport" @dragstart.prevent>
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

          <!-- Right Drawer (Search) -->
          <div v-if="showSearch" class="w-[300px] min-w-[300px] h-full border-l border-border bg-background">
            <Search />
          </div>
        </div>
      </EmbedPDF>
    </div>
  </div>
</template>

<style scoped>
.pdf-viewport {
  user-select: text;
  -webkit-user-drag: none;
}

.pdf-viewport :deep(img),
.pdf-viewport :deep(canvas) {
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
}
</style>
