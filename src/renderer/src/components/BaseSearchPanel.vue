<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Directory } from '../../../shared/types'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  directories: Record<string, Directory>
  selectedDirectory: string
  searchQuery: string
  availableTags: string[]
  extractedTags: string[]
  isSearchAlreadySaved: boolean
  searching: boolean
  searchError?: string
  searchResultsLength: number
}>()

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'update:selectedDirectory', value: string): void
  (event: 'performSearch'): void
  (event: 'saveSearch'): void
  (event: 'addTag', tag: string): void
  (event: 'removeTag', tag: string): void
}>()

const searchInputRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)

const currentSearchQuery = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit('update:searchQuery', value)
})

const currentSelectedDirectory = computed({
  get: () => props.selectedDirectory,
  set: (value: string) => emit('update:selectedDirectory', value)
})

const showHeader = computed(
  () => props.searchResultsLength === 0 && !props.searching && !props.searchError
)

const handleKeyPress = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    emit('performSearch')
  }
}

onMounted(() => {
  // Handle both Vue component ref and plain DOM element
  const el = searchInputRef.value
  const domElement = el && typeof el === 'object' && '$el' in el ? el.$el : el
  
  if (domElement && typeof domElement === 'object' && 'focus' in domElement) {
    const focusableElement = domElement as HTMLElement
    focusableElement.focus()
  }
})
</script>

<template>
  <div class="w-full shrink-0 px-8 pt-8 pb-4 bg-background border-b space-y-6">
    <div v-if="showHeader" class="text-center w-full max-w-2xl mx-auto">
      <h1 class="mb-2">What are you looking for today?</h1>
      <p class="text-muted-foreground">Search across your documents</p>
    </div>

    <div class="space-y-4 w-full max-w-2xl mx-auto">
      <div class="space-y-2">
        <div class="flex items-center gap-3 bg-accent rounded-lg px-4 py-3">
          <Input
            ref="searchInputRef"
            v-model="currentSearchQuery"
            type="text"
            placeholder="Search... (use #tag for filtering)"
            class="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            @keypress="handleKeyPress"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  :disabled="!currentSearchQuery.trim() || props.isSearchAlreadySaved"
                  :class="{ 'opacity-50': props.isSearchAlreadySaved }"
                  @click.prevent="emit('saveSearch')"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent v-if="props.isSearchAlreadySaved">
                <p>This search has already been saved</p>
              </TooltipContent>
              <TooltipContent v-else>
                <p>Save this search</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button @click.prevent="emit('performSearch')">
            Search <span class="bg-muted-foreground/25 rounded-md px-2">⏎</span>
          </Button>
        </div>

        <div v-if="props.extractedTags.length > 0" class="flex items-center gap-2 flex-wrap px-2">
          <span class="text-xs text-muted-foreground">Filtering by:</span>
          <button
            v-for="tag in props.extractedTags"
            :key="tag"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
            @click.prevent="emit('removeTag', tag)"
          >
            <span>#{{ tag }}</span>
            <span class="text-xs opacity-60">×</span>
          </button>
        </div>

        <div v-if="props.availableTags.length > 0" class="flex items-center gap-2 flex-wrap px-2">
          <span class="text-xs text-muted-foreground">Available tags:</span>
          <button
            v-for="tag in props.availableTags.filter((t) => !props.extractedTags.includes(t))"
            :key="tag"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent text-foreground rounded-md hover:bg-accent/70 transition-colors"
            @click.prevent="emit('addTag', tag)"
          >
            <span>#{{ tag }}</span>
            <span class="text-xs opacity-60">+</span>
          </button>
        </div>
      </div>

      <div>
        <Select v-model="currentSelectedDirectory">
          <SelectTrigger>
            <SelectValue placeholder="Select a directory" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All Directories</SelectItem>
              <SelectItem
                v-for="(dir, id) in props.directories"
                :key="id"
                :value="id"
                :disabled="!dir.exists"
              >
                {{ dir.name }}{{ !dir.exists ? ' (Not Found)' : '' }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</template>
