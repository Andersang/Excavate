<script setup lang="ts">
import { ref, computed } from 'vue'
import { BookmarkIcon } from 'lucide-vue-next'
import { emitBookmarkAdded } from '@/utils/appEvents'
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import SmartTagsInput from '@/components/SmartTagsInput.vue'
import { useNotification } from '@/composables/useNotification'
import { viewLogger } from '@/utils/logger'

interface Props {
  filePath?: string
}

const props = defineProps<Props>()

// Get current page from scroll state
const { state } = useScroll()
const currentPage = computed(() => state.value?.currentPage || 1)
const { error: showError, success: showSuccess } = useNotification()

const showDialog = ref(false)
const bookmarkName = ref('')
const bookmarkTags = ref<string[]>([])
const bookmarkNotes = ref('')
const isSaving = ref(false)
const availableTags = ref<string[]>([])

// Find directory and fileId for the current file
const findFileInfo = async (): Promise<{ directoryPath: string; fileId: string } | null> => {
  if (!props.filePath) return null

  try {
    const directories = await window.api.settings.getDirectories()

    // Check each directory to find which one contains this file
    for (const dir of Object.values(directories)) {
      if (!dir.exists) continue

      const configResult = await window.api.directory.readConfig(dir.path)
      if (configResult.success && configResult.config?.fileIndex) {
        const file = configResult.config.fileIndex.find(
          (f: { path: string }) => f.path === props.filePath
        )
        if (file) {
          return { directoryPath: dir.path, fileId: file.id }
        }
      }
    }
  } catch (error) {
    viewLogger.error('[BookmarkButton] Error finding file info:', error)
  }

  return null
}

const handleAddBookmark = async (): Promise<void> => {
  viewLogger.debug('[BookmarkButton] Adding bookmark for page:', currentPage.value)
  bookmarkName.value = ''
  bookmarkTags.value = []
  bookmarkNotes.value = ''

  // Load available tags
  try {
    const fileInfo = await findFileInfo()
    if (fileInfo) {
      const configResult = await window.api.directory.readConfig(fileInfo.directoryPath)
      if (configResult.success && configResult.config?.allTags) {
        availableTags.value = configResult.config.allTags
      }
    }
  } catch (error) {
    viewLogger.error('[BookmarkButton] Error loading tags:', error)
  }

  showDialog.value = true
}

const handleSaveBookmark = async (): Promise<void> => {
  if (!bookmarkName.value.trim()) {
    showError('Please enter a bookmark name')
    return
  }

  viewLogger.debug('[BookmarkButton] Current page:', currentPage.value)
  isSaving.value = true

  try {
    const fileInfo = await findFileInfo()

    if (!fileInfo) {
      viewLogger.error('[BookmarkButton] Cannot find directory or file ID')
      showError('Unable to save bookmark: file not found in any directory')
      return
    }

    const fileName = props.filePath?.split(/[\\/]/).pop() || 'Unknown'

    const plainBookmark = {
      fileId: String(fileInfo.fileId),
      filePath: String(props.filePath),
      fileName: String(fileName),
      page: Number(currentPage.value),
      name: String(bookmarkName.value.trim()),
      tags: [...bookmarkTags.value],
      notes: bookmarkNotes.value.trim() || undefined
    }

    viewLogger.debug('[BookmarkButton] Saving bookmark:', plainBookmark)

    const result = await window.api.bookmark.add(fileInfo.directoryPath, plainBookmark)

    if (result.success) {
      viewLogger.info('[BookmarkButton] Bookmark added successfully:', result.bookmark)
      showDialog.value = false
      emitBookmarkAdded()
      showSuccess('Bookmark added successfully')
    } else {
      viewLogger.error('[BookmarkButton] Failed to add bookmark:', result.error)
      showError('Failed to add bookmark: ' + result.error)
    }
  } catch (error) {
    viewLogger.error('[BookmarkButton] Error adding bookmark:', error)
    showError('Error adding bookmark')
  } finally {
    isSaving.value = false
  }
}

const handleCancel = (): void => {
  showDialog.value = false
}
</script>

<template>
  <div>
    <!-- Bookmark Button -->
    <button
      class="p-2 rounded hover:bg-muted transition-colors"
      title="Add bookmark"
      @click="handleAddBookmark"
    >
      <BookmarkIcon :size="18" />
    </button>

    <!-- Bookmark Dialog -->
    <div
      v-if="showDialog"
      class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50"
      @click.self="handleCancel"
    >
      <div class="bg-card rounded-lg p-6 w-full max-w-md border border-border shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Add Bookmark</h3>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors"
            @click="handleCancel"
          >
            ×
          </button>
        </div>

        <div class="space-y-4">
          <!-- Page Info -->
          <div class="text-sm text-muted-foreground">Page {{ currentPage }}</div>

          <!-- Bookmark Name -->
          <div>
            <label class="block text-sm font-medium mb-2">Name</label>
            <input
              v-model="bookmarkName"
              type="text"
              class="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter bookmark name"
              @keypress.enter="handleSaveBookmark"
            />
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium mb-2">Tags</label>
            <SmartTagsInput v-model="bookmarkTags" :available-tags="availableTags" />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium mb-2">Notes (optional)</label>
            <textarea
              v-model="bookmarkNotes"
              class="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
              placeholder="Add notes about this bookmark"
            />
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 mt-6">
            <button
              class="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md transition-colors"
              :disabled="isSaving"
              @click="handleCancel"
            >
              Cancel
            </button>
            <button
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!bookmarkName.trim() || isSaving"
              @click="handleSaveBookmark"
            >
              {{ isSaving ? 'Saving...' : 'Save Bookmark' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
