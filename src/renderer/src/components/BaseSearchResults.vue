<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResult } from '@/composables/useSearch'

const props = defineProps<{
  searching: boolean
  searchError?: string
  searchResults: SearchResult[]
  searchText: string
  extractedTags: string[]
}>()

const emit = defineEmits<{
  (event: 'openPdf', result: SearchResult): void
}>()

const showNoResults = computed(
  () =>
    !props.searching &&
    !props.searchError &&
    props.searchResults.length === 0 &&
    (props.searchText || props.extractedTags.length > 0)
)

const sanitizeSnippet = (snippet: string): string => snippet.replace(/<(?!\/?mark\b)[^>]*>/gi, '')
</script>

<template>
  <div>
    <div v-if="props.searching" class="text-center py-8">
      <p class="text-sm text-muted-foreground">Searching...</p>
    </div>

    <div v-if="props.searchError" class="text-center py-8">
      <p class="text-sm text-red-500">{{ props.searchError }}</p>
    </div>

    <div v-if="props.searchResults.length > 0" class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Found {{ props.searchResults.length }} result{{ props.searchResults.length !== 1 ? 's' : '' }}
      </p>

      <div class="space-y-2">
        <div
          v-for="(result, index) in props.searchResults"
          :key="`${result.filePath}:${result.pageNumber}:${index}`"
          class="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
          @click="emit('openPdf', result)"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1">
              <p class="text-sm font-medium">{{ result.fileName }}</p>
              <p class="text-xs text-muted-foreground font-mono">
                Page {{ result.pageNumber }}
              </p>
            </div>
          </div>
          <p
            class="text-sm text-muted-foreground leading-relaxed"
            v-html="sanitizeSnippet(result.snippet)"
          ></p>
        </div>
      </div>
    </div>

    <div v-if="showNoResults" class="text-center py-8">
      <p class="text-sm text-muted-foreground">No results found</p>
    </div>
  </div>
</template>
