<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'
import SmartTagsInput from '@/components/SmartTagsInput.vue'
import { Trash2 } from 'lucide-vue-next'

interface FileItem {
  id: string
  path: string
  name: string
  extension: string
  exists: boolean
  tags?: string[]
  checked?: boolean
  isProcessed?: boolean
  processingMethod?: 'local'
  size?: number
  modifiedAt?: string
}

const props = defineProps<{
  files: FileItem[]
  loading: boolean
  availableTags: string[]
  selectedFilePath?: string
  processingFiles?: Set<string>
  showHeader?: boolean
  headerTitle?: string
  headerSubtitle?: string
}>()

const emit = defineEmits<{
  'file-click': [file: FileItem]
  'toggle-selection': [file: FileItem]
  'toggle-select-all': [selected: boolean]
  'delete-selected': []
  'delete-file': [file: FileItem]
  'process-selected': []
  'update-tags': [fileId: string, tags: string[]]
  refresh: []
  close: []
}>()

// Search and filter state
const searchQuery = ref('')
const selectedTags = ref<string[]>([])

// Filtered files based on search and tags
const filteredFiles = computed(() => {
  let result = props.files

  // Filter by search query (simple case-insensitive search)
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    result = result.filter(
      (file) => file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
    )
  }

  // Filter by selected tags (files must have ALL selected tags)
  if (selectedTags.value.length > 0) {
    result = result.filter((file) => {
      const fileTags = file.tags || []
      return selectedTags.value.every((tag) => fileTags.includes(tag))
    })
  }

  return result
})

// Check if all filtered files are selected
const isAllSelected = computed(() => {
  if (filteredFiles.value.length === 0) return false
  return filteredFiles.value.every((file) => file.checked)
})

// Count of selected files
const selectedCount = computed(() => {
  return props.files.filter((file) => file.checked).length
})

// Check if any selected files are processed
const hasProcessedFiles = computed(() => {
  return props.files.some((file) => file.checked && file.isProcessed)
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

// Clear all filters
const clearFilters = (): void => {
  searchQuery.value = ''
  selectedTags.value = []
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div v-if="showHeader" class="flex items-center justify-between p-4 shrink-0 border-b">
      <div class="flex-1 min-w-0">
        <h2 class="">{{ headerTitle || 'Files' }}</h2>
        <p v-if="headerSubtitle" class="text-xs text-muted-foreground truncate">
          {{ headerSubtitle }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" :disabled="loading" @click="emit('refresh')"> ↻ </Button>
        <Button v-if="$attrs.onClose" variant="ghost" size="sm" @click="emit('close')"> ✕ </Button>
      </div>
    </div>

    <!-- Tags Filter -->
    <div v-if="availableTags.length > 0" class="px-4 pt-4 pb-2 shrink-0 border-b">
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

    <!-- Search Filter -->
    <div class="px-4 pt-3 pb-2 shrink-0 border-b">
      <Input v-model="searchQuery" type="text" placeholder="Search files..." class="h-8 text-sm" />
      <p v-if="searchQuery || selectedTags.length > 0" class="text-xs text-muted-foreground mt-2">
        Showing {{ filteredFiles.length }} of {{ files.length }} files
      </p>
    </div>

    <!-- Select All and Actions -->
    <div
      v-if="files.length > 0"
      class="flex items-center justify-between px-4 py-3 shrink-0 border-b"
    >
      <div class="flex items-center gap-2">
        <Checkbox
          id="select-all-files"
          :model-value="isAllSelected"
          @update:model-value="emit('toggle-select-all', $event as boolean)"
        />
        <label for="select-all-files" class="text-sm cursor-pointer"> Select All </label>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          :disabled="selectedCount === 0"
          @click="emit('delete-selected')"
        >
          Delete ({{ selectedCount }})
        </Button>
        <Button
          variant="default"
          size="sm"
          :disabled="selectedCount === 0"
          @click="emit('process-selected')"
        >
          {{ hasProcessedFiles ? 'Re-process' : 'Process' }} ({{ selectedCount }})
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <p class="text-sm text-muted-foreground">Loading files...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="files.length === 0" class="flex items-center justify-center py-8">
      <p class="text-sm text-muted-foreground italic">No files indexed</p>
    </div>

    <!-- Empty Filter Results -->
    <div
      v-else-if="filteredFiles.length === 0"
      class="flex items-center justify-center py-8 flex-col gap-2"
    >
      <p class="text-sm text-muted-foreground italic">No files match your filters</p>
      <Button variant="outline" size="sm" @click="clearFilters"> Clear filters </Button>
    </div>

    <!-- File List -->
    <ScrollArea v-else class="flex-1 overflow-auto">
      <div class="space-y-2 p-4">
        <div
          v-for="file in filteredFiles"
          :key="file.id"
          :class="[
            'p-3 border rounded-lg transition-colors',
            file.exists && (file.extension === 'pdf' || file.extension === '.pdf')
              ? 'cursor-pointer hover:bg-accent/30'
              : file.exists
                ? 'hover:bg-accent/30'
                : 'bg-red-500/10 border-red-500/30 opacity-60',
            file.path === selectedFilePath ? 'ring-2 ring-primary' : ''
          ]"
          @click="
            file.exists &&
            (file.extension === 'pdf' || file.extension === '.pdf') &&
            emit('file-click', file)
          "
        >
          <div class="flex items-start gap-3">
            <Checkbox
              class="mt-0.5"
              :model-value="file.checked"
              @update:model-value="emit('toggle-selection', file)"
              @click.stop
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium truncate flex-1 select-text" @mousedown.stop>
                  {{ file.name }}
                </p>
                <span
                  v-if="processingFiles && processingFiles.has(file.id)"
                  class="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded shrink-0"
                >
                  Processing...
                </span>
                <span
                  v-else-if="file.isProcessed"
                  class="text-xs px-2 py-0.5 bg-green-500/20 text-green-500 rounded shrink-0 flex items-center gap-1"
                >
                  <span>✓ Processed</span>
                  <span v-if="file.processingMethod" class="opacity-60"
                    >({{ file.processingMethod }})</span
                  >
                </span>
                <div v-else-if="!file.exists" class="flex items-center gap-1 shrink-0">
                  <span class="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded">
                    Missing
                  </span>
                  <button
                    class="p-1 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                    title="Delete missing file"
                    @click.stop="emit('delete-file', file)"
                  >
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
              <p class="text-xs text-muted-foreground font-mono truncate mt-1">
                {{ file.path }}
              </p>
              <div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{{ ((file.size || 0) / 1024).toFixed(1) }} KB</span>
                <span>•</span>
                <span>{{ file.extension }}</span>
              </div>

              <!-- Tags Input -->
              <div class="mt-2" @click.stop>
                <SmartTagsInput
                  :model-value="file.tags || []"
                  :available-tags="availableTags"
                  @update:model-value="(tags) => emit('update-tags', file.id, tags)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
