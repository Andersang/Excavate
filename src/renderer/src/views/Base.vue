<script setup lang="ts">
import { ref, onMounted, onActivated, computed, watch, onBeforeUnmount } from 'vue'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'
import embedPDFMain from '@renderer/components/EmbedPDFUI/embedPDFMain.vue'
import { Document, Charset } from 'flexsearch'
import { usePdfViewer } from '@/composables/usePdfViewer'
import { searchLogger, uiLogger } from '@/utils/logger'

interface SearchDocument {
  id: string
  filePath: string
  fileName: string
  pageNumber: number
  content: string
  [key: string]: string | number // Index signature for FlexSearch
}

interface Directory {
  path: string
  name: string
  exists: boolean
  settings: {
    watchForChanges: boolean
    excludePatterns: string[]
    fileTypes: string[]
  }
}

interface SearchResult {
  filePath: string
  fileName: string
  pageNumber: number
  snippet: string
  score: number
}

const directories = ref<Record<string, Directory>>({})
const directoriesExist = ref(false)
const selectedDirectory = ref('all')
const searchQuery = ref('')
const searchInputRef = ref()
const searching = ref(false)
const searchResults = ref<SearchResult[]>([])
const searchError = ref<string | null>(null)
const availableTags = ref<string[]>([])
const savedSearches = ref<Awaited<ReturnType<typeof window.api.search.getSaved>>>([])

// Use PDF Viewer composable
const {
  selectedPdfPath,
  selectedPdfPage,
  isPdfViewerOpen,
  isOwnPdfViewer,
  pdfPanelWidth,
  isResizing,
  searchPanelWidth,
  openPdf,
  startResize
} = usePdfViewer('search')

// Load saved searches
const loadSavedSearches = async (): Promise<void> => {
  try {
    savedSearches.value = await window.api.search.getSaved()
  } catch (error) {
    searchLogger.error('Failed to load saved searches:', error)
  }
}

// Check if current search query is already saved
const isSearchAlreadySaved = computed(() => {
  const currentQuery = searchQuery.value.trim()
  if (!currentQuery) return false
  return savedSearches.value.some((search) => search.name === currentQuery)
})

// Get available tags from selected directories
const loadAvailableTags = async (): Promise<void> => {
  const tagsSet = new Set<string>()

  const directoriesToCheck =
    selectedDirectory.value === 'all'
      ? Object.values(directories.value).filter((dir) => dir.exists)
      : [directories.value[selectedDirectory.value]].filter((dir) => dir && dir.exists)

  searchLogger.debug('Loading tags from directories:', directoriesToCheck.length)

  for (const dir of directoriesToCheck) {
    try {
      const configResult = await window.api.directory.readConfig(dir.path)
      if (configResult.success && configResult.config) {
        // Use allTags if available
        if (configResult.config.allTags && Array.isArray(configResult.config.allTags)) {
          searchLogger.debug('Found allTags in config:', configResult.config.allTags)
          configResult.config.allTags.forEach((tag: string) => tagsSet.add(tag))
        } else {
          // Fallback: collect tags from all files
          searchLogger.debug('No allTags field, collecting from files...')
          configResult.config.fileIndex?.forEach((file) => {
            if (file.tags && Array.isArray(file.tags)) {
              file.tags.forEach((tag) => tagsSet.add(tag))
            }
          })
        }
      }
    } catch (error) {
      searchLogger.error('Error loading tags from directory:', error)
    }
  }

  const tags = Array.from(tagsSet).sort()
  searchLogger.debug('Available tags:', tags)
  availableTags.value = tags
}

// Add tag to search query
const addTag = (tag: string): void => {
  if (!extractedTags.value.includes(tag)) {
    searchQuery.value = `${searchQuery.value} #${tag}`.trim()
  }
}

// Extract tags from search query
const extractedTags = computed(() => {
  const tags: string[] = []
  const matches = searchQuery.value.match(/#[\w-]+/g)
  if (matches) {
    matches.forEach((tag) => {
      const cleanTag = tag.substring(1) // Remove the # symbol
      if (cleanTag && !tags.includes(cleanTag)) {
        tags.push(cleanTag)
      }
    })
  }
  return tags
})

// Get search text without tags
const searchText = computed(() => {
  return searchQuery.value.replace(/#[\w-]+/g, '').trim()
})

// Extract exact phrases (quoted text) and regular terms from search text
const parseSearchQuery = (query: string): { exactPhrases: string[]; regularTerms: string[] } => {
  const exactPhrases: string[] = []
  const regularTerms: string[] = []
  
  // Extract quoted phrases
  const quoteRegex = /"([^"]+)"/g
  let match
  let remainingQuery = query
  
  while ((match = quoteRegex.exec(query)) !== null) {
    exactPhrases.push(match[1])
    remainingQuery = remainingQuery.replace(match[0], '')
  }
  
  // Extract remaining terms (non-quoted)
  const terms = remainingQuery
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
  regularTerms.push(...terms)

  return { exactPhrases, regularTerms }
}

// Remove a tag from the search query
const removeTag = (tagToRemove: string): void => {
  searchQuery.value = searchQuery.value.replace(new RegExp(`#${tagToRemove}\\b`, 'g'), '').trim()
}

// Check if directories exist
const checkDirectoriesExist = async (): Promise<void> => {
  directories.value = await window.api.settings.getDirectories()
  // Check if any directories exist AND are valid (exists: true)
  const validDirectories = Object.values(directories.value).filter((dir) => dir.exists === true)
  directoriesExist.value = validDirectories.length > 0
}

// Auto-focus search input when view loads
onMounted(async () => {
  await checkDirectoriesExist()
  await loadAvailableTags()
  await loadSavedSearches()
  searchInputRef.value?.$el?.focus()

  // Listen for execute-saved-search events
  window.addEventListener('execute-saved-search', (event: Event) => {
    const customEvent = event as CustomEvent<string>
    searchQuery.value = customEvent.detail
    // Trigger search
    performSearch()
  })

  // Listen for directory-added events to refresh directory list and tags
  window.addEventListener('directory-added', async () => {
    await checkDirectoriesExist()
    await loadAvailableTags()
  })
})

onBeforeUnmount(() => {
  // Cleanup event listeners if needed
})

// Reclaim PDF viewer ownership when returning to this view
onActivated(() => {
  if (selectedPdfPath.value && selectedPdfPage.value) {
    uiLogger.debug('Reclaiming PDF viewer ownership')
    openPdf(selectedPdfPath.value, selectedPdfPage.value)
  }
})

// Reload tags when directory selection changes
watch(selectedDirectory, () => {
  loadAvailableTags()
})

// Build FlexSearch index from filtered files
const buildSearchIndex = async (): Promise<Document<SearchDocument>> => {
  const index = new Document<SearchDocument>({
    tokenize: 'tolerant',
    encoder: Charset.LatinAdvanced,
    context: {
      resolution: 5,
      depth: 3,
      bidirectional: true
    },
    store: true,
    document: {
      id: 'id',
      index: ['content'],
      store: ['filePath', 'fileName', 'pageNumber', 'content']
    }
  })

  // Step 1: Get directories to search
  const directoriesToSearch: Array<{ id: string; path: string }> = []

  if (selectedDirectory.value === 'all') {
    Object.entries(directories.value).forEach(([id, dir]) => {
      if (dir.exists) {
        directoriesToSearch.push({ id, path: dir.path })
      }
    })
  } else {
    const dir = directories.value[selectedDirectory.value]
    if (dir && dir.exists) {
      directoriesToSearch.push({ id: selectedDirectory.value, path: dir.path })
    }
  }

  if (directoriesToSearch.length === 0) {
    throw new Error('No valid directories to search')
  }

  // Step 2: Load files from each directory and filter by tags
  const documentsToIndex: SearchDocument[] = []

  for (const dir of directoriesToSearch) {
    try {
      const configResult = await window.api.directory.readConfig(dir.path)
      if (!configResult.success || !configResult.config) continue

      const fileIndex = configResult.config.fileIndex || []

      // Filter by tags if specified
      const filteredFiles =
        extractedTags.value.length > 0
          ? fileIndex.filter((file) => {
              if (!file.tags || !Array.isArray(file.tags)) return false
              // File must have ANY of the specified tags (OR logic)
              return extractedTags.value.some((tag) => file.tags!.includes(tag))
            })
          : fileIndex

      // Step 3: Load processed JSONs for filtered files
      for (const file of filteredFiles) {
        const pathParts = file.path.split(/[\\/]/)
        const fileName = pathParts[pathParts.length - 1]
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
        const fileDirectory = pathParts.slice(0, -1).join('\\')

        const processedPath = `${fileDirectory}\\panopticon-processed\\${fileNameWithoutExt}-processed.json`

        try {
          const exists = await window.api.file.exists(processedPath)
          if (!exists) continue

          const jsonContent = await window.api.file.read(processedPath)
          const processedDoc = JSON.parse(jsonContent)

          // Add each page as a separate document
          if (processedDoc.content && Array.isArray(processedDoc.content)) {
            processedDoc.content.forEach((page: { pageNumber: number; content: string }) => {
              documentsToIndex.push({
                id: `${file.path}_page_${page.pageNumber}`,
                filePath: file.path,
                fileName: file.name,
                pageNumber: page.pageNumber,
                content: page.content || ''
              })
            })
          }
        } catch (error) {
          searchLogger.error(`Error loading processed JSON for ${file.name}:`, error)
        }
      }
    } catch (error) {
      searchLogger.error(`Error loading directory ${dir.path}:`, error)
    }
  }

  if (documentsToIndex.length === 0) {
    throw new Error('No processed documents found to search')
  }

  // Step 4: Add documents to index
  documentsToIndex.forEach((doc) => index.add(doc))

  searchLogger.info(`Built search index with ${documentsToIndex.length} pages`)
  return index
}

// Search activation function
const performSearch = async (): Promise<void> => {
  if (!searchText.value.trim() && extractedTags.value.length === 0) {
    return
  }

  searching.value = true
  searchError.value = null
  searchResults.value = []

  try {
    searchLogger.debug('Building search index...')
    const index = await buildSearchIndex()

    // Parse the search query for exact phrases and regular terms
    const { exactPhrases, regularTerms } = parseSearchQuery(searchText.value)
    searchLogger.debug('Exact phrases:', exactPhrases)
    searchLogger.debug('Regular terms:', regularTerms)
    
    // For FlexSearch, we'll search using regular terms only
    // Then filter results by exact phrases manually
    const searchTerms = regularTerms.join(' ')
    
    searchLogger.debug('Searching for:', searchTerms)
    const results = await index.searchAsync(searchTerms || searchText.value, {
      limit: 50,
      enrich: true,
      highlight: {
        template: '<mark class="bg-yellow-500/30 text-foreground">$1</mark>',
        clip: false,
        merge: true
      }
    })

    searchLogger.debug('FlexSearch results:', results)

    // Process results
    const processedResults: SearchResult[] = []

    results.forEach((result) => {
      searchLogger.debug('Result item:', result)
      if (!result.result) return

      result.result.forEach((item) => {
        searchLogger.debug('Item in result:', item)
        const doc = item.doc
        if (!doc) return

        // Check if exact phrases match (if any were specified)
        let matchesExactPhrases = true
        if (exactPhrases.length > 0) {
          const contentLower = doc.content.toLowerCase()
          matchesExactPhrases = exactPhrases.every((phrase) =>
            contentLower.includes(phrase.toLowerCase())
          )
        }

        // Only include result if it matches exact phrases (or no phrases specified)
        if (!matchesExactPhrases) {
          return
        }

        // FlexSearch provides highlighted snippet with <mark> tags already applied
        const snippet =
          item.highlight || doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : '')
        searchLogger.debug('Using snippet:', snippet)

        processedResults.push({
          filePath: doc.filePath,
          fileName: doc.fileName,
          pageNumber: doc.pageNumber,
          snippet,
          score: 0
        })
      })
    })

    searchResults.value = processedResults
    searchLogger.info(`Found ${processedResults.length} results`)

    // Add to search history
    if (searchQuery.value.trim()) {
      await window.api.search.addHistory(
        searchQuery.value.trim(),
        searchText.value,
        extractedTags.value,
        processedResults.length
      )
      window.dispatchEvent(new CustomEvent('refresh-saved-searches'))
    }
  } catch (error) {
    searchLogger.error('Search error:', error)
    searchError.value = error instanceof Error ? error.message : 'Search failed'
  } finally {
    searching.value = false
  }
}

// Handle Enter key press
const handleKeyPress = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    performSearch()
  }
}

// Save current search using query as the name
const saveSearch = async (): Promise<void> => {
  if (!searchQuery.value.trim() || isSearchAlreadySaved.value) {
    return
  }

  try {
    // Use the full query (with tags) as the search name
    const searchName = searchQuery.value.trim()
    await window.api.search.save(searchName, searchText.value, extractedTags.value)
    // Reload saved searches locally
    await loadSavedSearches()
    // Emit event to refresh saved searches in parent
    window.dispatchEvent(new CustomEvent('refresh-saved-searches'))
  } catch (error) {
    searchLogger.error('Failed to save search:', error)
  }
}

// PDF Viewer handler - wraps the composable's openPdf to accept SearchResult
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
        <!-- Fixed Header Section -->
        <div class="w-full shrink-0 px-8 pt-8 pb-4 bg-background border-b space-y-6">
          <!-- Heading - Only show when no search has been performed -->
          <div
            v-if="searchResults.length === 0 && !searching && !searchError"
            class="text-center w-full max-w-2xl mx-auto"
          >
            <h1 class="mb-2">What are you looking for today?</h1>
            <p class="text-muted-foreground">Search across your documents</p>
          </div>

          <!-- Search Section -->
          <div class="space-y-4 w-full max-w-2xl mx-auto">
            <!-- Search Input -->
            <div class="space-y-2">
              <div class="flex items-center gap-3 bg-accent rounded-lg px-4 py-3">
                <Input
                  ref="searchInputRef"
                  v-model="searchQuery"
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
                        :disabled="!searchQuery.trim() || isSearchAlreadySaved"
                        :class="{ 'opacity-50': isSearchAlreadySaved }"
                        @click="saveSearch"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
                          ></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent v-if="isSearchAlreadySaved">
                      <p>This search has already been saved</p>
                    </TooltipContent>
                    <TooltipContent v-else>
                      <p>Save this search</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button @click="performSearch"
                  >Search <span class="bg-muted-foreground/25 rounded-md px-2">⏎</span></Button
                >
              </div>

              <!-- Extracted Tags Display -->
              <div v-if="extractedTags.length > 0" class="flex items-center gap-2 flex-wrap px-2">
                <span class="text-xs text-muted-foreground">Filtering by:</span>
                <button
                  v-for="tag in extractedTags"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                  @click="removeTag(tag)"
                >
                  <span>#{{ tag }}</span>
                  <span class="text-xs opacity-60">×</span>
                </button>
              </div>

              <!-- Available Tags -->
              <div v-if="availableTags.length > 0" class="flex items-center gap-2 flex-wrap px-2">
                <span class="text-xs text-muted-foreground">Available tags:</span>
                <button
                  v-for="tag in availableTags.filter((t) => !extractedTags.includes(t))"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent text-foreground rounded-md hover:bg-accent/70 transition-colors"
                  @click="addTag(tag)"
                >
                  <span>#{{ tag }}</span>
                  <span class="text-xs opacity-60">+</span>
                </button>
              </div>
            </div>

            <!-- Directory Select -->
            <div>
              <Select v-model="selectedDirectory">
                <SelectTrigger>
                  <SelectValue placeholder="Select a directory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Directories</SelectItem>
                    <SelectItem
                      v-for="(dir, id) in directories"
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

        <!-- Scrollable Results Section -->
        <ScrollArea class="flex-1 overflow-hidden">
          <div class="w-full max-w-2xl mx-auto px-8 py-6">
            <!-- Search Status -->
            <div v-if="searching" class="text-center py-8">
              <p class="text-sm text-muted-foreground">Searching...</p>
            </div>

            <!-- Search Error -->
            <div v-if="searchError" class="text-center py-8">
              <p class="text-sm text-red-500">{{ searchError }}</p>
            </div>

            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="space-y-4">
              <p class="text-sm text-muted-foreground">
                Found {{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}
              </p>

              <div class="space-y-2">
                <div
                  v-for="(result, index) in searchResults"
                  :key="index"
                  class="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  @click="openPdfFromResult(result)"
                >
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div class="flex-1">
                      <p class="text-sm font-medium">{{ result.fileName }}</p>
                      <p class="text-xs text-muted-foreground font-mono">
                        Page {{ result.pageNumber }}
                      </p>
                    </div>
                  </div>
                  <p class="text-sm text-muted-foreground leading-relaxed" v-html="result.snippet"></p>
                </div>
              </div>
            </div>

            <!-- No Results -->
            <div
              v-if="
                !searching &&
                !searchError &&
                searchResults.length === 0 &&
                (searchText || extractedTags.length > 0)
              "
              class="text-center py-8"
            >
              <p class="text-sm text-muted-foreground">No results found</p>
            </div>
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
