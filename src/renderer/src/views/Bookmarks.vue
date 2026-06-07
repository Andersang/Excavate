<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated, computed } from 'vue'
import type { Directory, Bookmark as SharedBookmark } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import SmartTagsInput from '@/components/SmartTagsInput.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import embedPDFMain from '@/components/EmbedPDFUI/embedPDFMain.vue'
import { usePdfViewer } from '@/composables/usePdfViewer'
import { useNotification } from '@/composables/useNotification'
import { uiLogger } from '@/utils/logger'
import { formatDate } from '@/utils/format'

interface BookmarkWithPath extends SharedBookmark {
  directoryPath?: string
  directoryName?: string
}

const directories = ref<Record<string, Directory>>({})
const allBookmarks = ref<BookmarkWithPath[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const { error: showError, success: showSuccess } = useNotification()

// Use PDF Viewer composable
const {
  selectedPdfPath,
  selectedPdfPage,
  isOwnPdfViewer,
  pdfPanelWidth,
  isResizing,
  searchPanelWidth,
  openPdf,
  startResize
} = usePdfViewer('bookmarks')

// Get all unique tags from bookmarks
const availableTags = computed(() => {
  const tagSet = new Set<string>()
  allBookmarks.value.forEach((bookmark) => {
    bookmark.tags.forEach((tag) => tagSet.add(tag))
  })
  return Array.from(tagSet).sort()
})

// Filtered bookmarks
const filteredBookmarks = computed(() => {
  let result = allBookmarks.value

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(
      (bookmark) =>
        bookmark.name.toLowerCase().includes(query) ||
        bookmark.fileName.toLowerCase().includes(query) ||
        bookmark.notes?.toLowerCase().includes(query) ||
        bookmark.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }

  // Filter by selected tags
  if (selectedTags.value.length > 0) {
    result = result.filter((bookmark) =>
      selectedTags.value.every((tag) => bookmark.tags.includes(tag))
    )
  }

  // Sort by created date (newest first)
  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

// Toggle tag selection
const toggleTag = (tag: string): void => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

// Clear filters
const clearFilters = (): void => {
  searchQuery.value = ''
  selectedTags.value = []
}

// Update bookmark tags
const updateBookmarkTags = async (bookmark: BookmarkWithPath, tags: string[]): Promise<void> => {
  if (!bookmark.directoryPath) {
    showError('Cannot update tags: directory path not found')
    return
  }

  try {
    // Convert to plain array to avoid reactive proxy issues
    const plainTags = [...tags]

    const result = await window.api.bookmark.update(
      bookmark.directoryPath,
      bookmark.id,
      { tags: plainTags }
    )

    if (result.success) {
      // Update local state with sanitized tags from backend
      const sanitizedTags = result.bookmark?.tags || plainTags
      allBookmarks.value = allBookmarks.value.map((b) =>
        b.id === bookmark.id ? { ...b, tags: sanitizedTags } : b
      )
      showSuccess('Tags updated successfully')
    } else {
      showError('Failed to update tags: ' + result.error)
    }
  } catch (error) {
    uiLogger.error('Error updating bookmark tags:', error)
    showError('An error occurred while updating tags')
  }
}

// Load bookmarks from all directories
const loadBookmarks = async (): Promise<void> => {
  loading.value = true
  allBookmarks.value = []

  try {
    // Get all directories
    const dirs = await window.api.settings.getDirectories()
    directories.value = dirs

    // Load bookmarks from each directory
    for (const [, directory] of Object.entries(dirs)) {
      if (!directory.exists) continue

      try {
        const result = await window.api.bookmark.getAll(directory.path)
        if (result.success && result.bookmarks) {
          // Add directory info to each bookmark
          const bookmarksWithDir = result.bookmarks.map((bookmark) => ({
            ...bookmark,
            directoryPath: directory.path,
            directoryName: directory.name
          }))
          allBookmarks.value.push(...bookmarksWithDir)
        }
      } catch (error) {
        uiLogger.error(`Error loading bookmarks from ${directory.name}:`, error)
      }
    }

    uiLogger.info('Loaded bookmarks:', allBookmarks.value.length)
  } catch (error) {
    uiLogger.error('Error loading directories:', error)
  } finally {
    loading.value = false
  }
}

// Open bookmark (show PDF in viewer)
const openBookmark = (bookmark: BookmarkWithPath): void => {
  openPdf(bookmark.filePath, bookmark.page)
}

interface ConfirmDialogState {
  open: boolean
  title: string
  message: string
  onConfirm: (() => void) | null
}

const confirmDialogState = ref<ConfirmDialogState>({
  open: false,
  title: '',
  message: '',
  onConfirm: null
})

const notificationMessage = ref<{ type: 'error' | 'success'; text: string } | undefined>(undefined)

const openConfirm = (title: string, message: string, onConfirm: () => void): void => {
  confirmDialogState.value = { open: true, title, message, onConfirm }
}

const handleConfirm = (): void => {
  confirmDialogState.value.open = false
  confirmDialogState.value.onConfirm?.()
}

const clearNotification = (): void => {
  notificationMessage.value = undefined
}

// Delete bookmark
const deleteBookmark = (bookmark: BookmarkWithPath): void => {
  openConfirm('Delete Bookmark', `Delete bookmark "${bookmark.name}"?`, async () => {
    if (!bookmark.directoryPath) {
      uiLogger.error('Missing directory path')
      notificationMessage.value = { type: 'error', text: 'Cannot delete: missing directory path.' }
      return
    }
    try {
      const result = await window.api.bookmark.remove(bookmark.directoryPath, bookmark.id)
      if (result.success) {
        allBookmarks.value = allBookmarks.value.filter((b) => b.id !== bookmark.id)
        uiLogger.info('Deleted bookmark:', bookmark.id)
      } else {
        uiLogger.error('Failed to delete bookmark:', result.error)
        notificationMessage.value = {
          type: 'error',
          text: `Failed to delete bookmark: ${result.error}`
        }
      }
    } catch (error) {
      uiLogger.error('Error deleting bookmark:', error)
      notificationMessage.value = {
        type: 'error',
        text: 'An error occurred while deleting the bookmark.'
      }
    }
  })
}

// Format date
onMounted(() => {
  loadBookmarks()

  // Listen for bookmark-added events to refresh the list
  window.addEventListener('bookmark-added', loadBookmarks)

  // Listen for directory-added events to refresh bookmarks list
  window.addEventListener('directory-added', loadBookmarks)
})

// Reclaim PDF viewer ownership when returning to this view
onActivated(() => {
  if (selectedPdfPath.value && selectedPdfPage.value) {
    uiLogger.debug('Reclaiming PDF viewer ownership')
    openPdf(selectedPdfPath.value, selectedPdfPage.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('bookmark-added', loadBookmarks)
  window.removeEventListener('directory-added', loadBookmarks)
})
</script>

<template>
  <div class="h-full w-full flex overflow-hidden relative">
    <!-- Notification banner -->
    <div
      v-if="notificationMessage"
      :class="[
        'absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 text-sm',
        notificationMessage.type === 'error'
          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-green-500/10 text-green-700 dark:text-green-400'
      ]"
    >
      <span>{{ notificationMessage.text }}</span>
      <button class="ml-4 text-xs opacity-60 hover:opacity-100" @click="clearNotification">
        ✕
      </button>
    </div>

    <!-- Bookmarks Panel -->
    <div
      class="bookmarks-panel h-full transition-all duration-300 ease-in-out shrink-0"
      :class="{ 'pdf-open': isOwnPdfViewer }"
      :style="{ width: `${searchPanelWidth}%` }"
    >
      <div class="flex flex-col overflow-hidden h-full">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h1 class="truncate">Bookmarks</h1>
            <p class="text-sm text-muted-foreground">
              {{ filteredBookmarks.length }} bookmark{{ filteredBookmarks.length !== 1 ? 's' : '' }}
            </p>
          </div>
          <Button variant="ghost" size="sm" :disabled="loading" @click="loadBookmarks">
            ↻ Refresh
          </Button>
        </div>

        <!-- Tags Filter -->
        <div v-if="availableTags.length > 0" class="px-6 pt-4 pb-2 shrink-0 border-b">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-muted-foreground">Filter by tags</p>
            <Button
              v-if="selectedTags.length > 0 || searchQuery"
              variant="ghost"
              size="sm"
              class="h-6 px-2 text-xs"
              @click="clearFilters"
            >
              Clear filters
            </Button>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in availableTags"
              :key="tag"
              :aria-pressed="selectedTags.includes(tag)"
              :class="[
                'px-2 py-1 text-xs rounded-md transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              ]"
              @click="toggleTag(tag)"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <!-- Search -->
        <div class="px-6 pt-3 pb-2 shrink-0 border-b">
          <Input v-model="searchQuery" type="text" placeholder="Search bookmarks..." class="h-9" />
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="text-center">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
            ></div>
            <p class="mt-2 text-sm text-muted-foreground">Loading bookmarks...</p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="allBookmarks.length === 0" class="flex items-center justify-center py-12">
          <div class="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto mb-4 text-muted-foreground"
            >
              <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
            </svg>
            <p class="text-sm font-medium">No bookmarks yet</p>
            <p class="text-xs text-muted-foreground mt-1">
              Open a PDF and click the bookmark icon to save pages
            </p>
          </div>
        </div>

        <!-- No Results -->
        <div
          v-else-if="filteredBookmarks.length === 0"
          class="flex items-center justify-center py-12 flex-col gap-2"
        >
          <p class="text-sm text-muted-foreground">No bookmarks match your filters</p>
          <Button variant="outline" size="sm" @click="clearFilters"> Clear filters </Button>
        </div>

        <!-- Bookmarks List -->
        <ScrollArea v-else class="flex-1 overflow-auto">
          <div class="px-6 py-4 space-y-3">
            <div
              v-for="bookmark in filteredBookmarks"
              :key="bookmark.id"
              class="border rounded-lg p-4 hover:bg-accent/30 transition-colors cursor-pointer"
              @click="openBookmark(bookmark)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <!-- Bookmark Name -->
                  <h3 class="text-sm font-medium mb-1">{{ bookmark.name }}</h3>

                  <!-- File Info -->
                  <div class="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span class="truncate">{{ bookmark.fileName }}</span>
                    <span>•</span>
                    <span>Page {{ bookmark.page }}</span>
                    <span v-if="bookmark.directoryName">•</span>
                    <span v-if="bookmark.directoryName" class="truncate">{{
                      bookmark.directoryName
                    }}</span>
                  </div>

                  <!-- Tags -->
                  <div v-if="bookmark.tags.length > 0" class="flex flex-wrap gap-1 mb-2">
                    <span
                      v-for="tag in bookmark.tags"
                      :key="tag"
                      class="px-1.5 py-0.5 text-xs bg-muted rounded"
                    >
                      {{ tag }}
                    </span>
                  </div>

                  <!-- Tags Input -->
                  <div class="mt-2" @click.stop>
                    <SmartTagsInput
                      :model-value="bookmark.tags"
                      :available-tags="availableTags"
                      @update:model-value="(tags) => updateBookmarkTags(bookmark, tags)"
                    />
                  </div>

                  <!-- Notes -->
                  <p
                    v-if="bookmark.notes"
                    class="text-xs text-muted-foreground italic line-clamp-2"
                  >
                    {{ bookmark.notes }}
                  </p>

                  <!-- Date -->
                  <p class="text-xs text-muted-foreground mt-2">
                    {{ formatDate(bookmark.createdAt) }}
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0"
                    title="Delete"
                    @click.stop="deleteBookmark(bookmark)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
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
        :key="`bookmarks-${selectedPdfPath}`"
        :file-path="selectedPdfPath || undefined"
        :initial-page="selectedPdfPage || 1"
        view-source="bookmarks"
      />
    </div>
  </div>
  <!-- Confirmation Dialog -->
  <Dialog :open="confirmDialogState.open" @update:open="(v) => (confirmDialogState.open = v)">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>{{ confirmDialogState.title }}</DialogTitle>
        <DialogDescription style="white-space: pre-line">{{
          confirmDialogState.message
        }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="confirmDialogState.open = false">Cancel</Button>
        <Button variant="destructive" @click="handleConfirm">Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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
