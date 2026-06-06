<script setup lang="ts">
import { usePdfViewer } from '@/composables/usePdfViewer'
import { useSearch, type SearchResult } from '@/composables/useSearch'
import BaseSearchPanel from '@/components/BaseSearchPanel.vue'
import BaseSearchResults from '@/components/BaseSearchResults.vue'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'
import embedPDFMain from '@renderer/components/EmbedPDFUI/embedPDFMain.vue'

const {
  directories,
  directoriesExist,
  selectedDirectory,
  searchQuery,
  searching,
  searchResults,
  searchError,
  availableTags,
  extractedTags,
  isSearchAlreadySaved,
  searchText,
  performSearch,
  saveSearch,
  addTag,
  removeTag
} = useSearch()

const {
  selectedPdfPath,
  selectedPdfPage,
  isPdfViewerOpen,
  isOwnPdfViewer,
  pdfPanelWidth,
  searchPanelWidth,
  isResizing,
  openPdf,
  startResize
} = usePdfViewer('search')


const updateSearchQuery = (value: string): void => {
  searchQuery.value = value
}

const updateSelectedDirectory = (value: string): void => {
  selectedDirectory.value = value
}

const openPdfFromResult = (result: SearchResult): void => {
  openPdf(result.filePath, result.pageNumber)
}
</script>

<template>
  <div class="h-full w-full flex overflow-hidden relative">
    <!-- Search Panel -->
    <div
      class="search-panel h-full transition-all duration-300 ease-in-out shrink-0 flex flex-col"
      :class="{ 'pdf-open': isPdfViewerOpen }"
      :style="{ width: `${searchPanelWidth}%` }"
    >
      <template v-if="!directoriesExist">
        <div class="text-center space-y-4 m-auto">
          <h2>No directories configured</h2>
          <p class="text-muted-foreground">
            Please add your first directory in
            <router-link class="underline" to="/library">Library</router-link>.
          </p>
        </div>
      </template>

      <template v-else>
        <BaseSearchPanel
          :directories="directories"
          :selectedDirectory="selectedDirectory"
          :searchQuery="searchQuery"
          :availableTags="availableTags"
          :extractedTags="extractedTags"
          :isSearchAlreadySaved="isSearchAlreadySaved"
          :searching="searching"
          :searchError="searchError"
          :searchResultsLength="searchResults.length"
          @update:searchQuery="updateSearchQuery"
          @update:selectedDirectory="updateSelectedDirectory"
          @performSearch="performSearch"
          @saveSearch="saveSearch"
          @addTag="addTag"
          @removeTag="removeTag"
        />

        <ScrollArea class="flex-1 overflow-hidden">
          <div class="w-full max-w-2xl mx-auto px-8 py-6">
            <BaseSearchResults
              :searching="searching"
              :searchError="searchError"
              :searchResults="searchResults"
              :searchText="searchText"
              :extractedTags="extractedTags"
              @openPdf="openPdfFromResult"
            />
          </div>
        </ScrollArea>
      </template>
    </div>

    <!-- Resizer -->
    <div
      v-if="isOwnPdfViewer"
      class="resizer"
      :class="{ resizing: isResizing }"
      @mousedown="startResize"
    ></div>

    <!-- PDF Viewer Panel -->
    <div
      class="pdf-viewer-panel transition-all duration-300 ease-in-out"
      :class="{ open: isOwnPdfViewer }"
      :style="{ width: isOwnPdfViewer ? `${pdfPanelWidth}%` : '0' }"
    >
      <embedPDFMain
        v-show="isOwnPdfViewer && selectedPdfPath"
        :key="`search-${selectedPdfPath}`"
        :file-path="selectedPdfPath || undefined"
        :initial-page="selectedPdfPage || 1"
        view-source="search"
      />
    </div>
  </div>
</template>

<style scoped>
.resizer {
  width: 4px;
  background-color: hsl(var(--border));
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.resizer:hover {
  background-color: hsl(var(--primary));
}

.resizer.resizing {
  background-color: hsl(var(--primary));
}

.pdf-viewer-panel {
  overflow: hidden;
}

.pdf-viewer-panel.open {
  border-left: 1px solid hsl(var(--border));
}
</style>
