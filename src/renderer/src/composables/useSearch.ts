import { ref, computed, onMounted, onActivated, onBeforeUnmount, watch } from 'vue'
import { Document, Charset } from 'flexsearch'
import type { Directory } from '../../../shared/types'

interface SearchDocument {
  id: string
  filePath: string
  fileName: string
  pageNumber: number
  content: string
  [key: string]: string | number
}

export interface SearchResult {
  filePath: string
  fileName: string
  pageNumber: number
  snippet: string
  score: number
}

interface SavedSearch {
  id: string
  name: string
}

/**
 * Module-level state for search functionality.
 *
 * @remarks
 * This composable uses a singleton pattern with module-level refs to maintain
 * shared state across all components that use search (Base.vue, Library.vue, etc.).
 *
 * The search index and results are cached at the module level to avoid rebuilding
 * the index when switching between views. Event listeners are registered once and
 * shared across all component instances.
 *
 * Lifecycle considerations:
 * - State persists across component mount/unmount cycles
 * - Event listeners are registered once and never removed (singleton pattern)
 * - Cached index is keyed by directory selection to invalidate when needed
 */
const directories = ref<Record<string, Directory>>({})
const directoriesExist = ref(false)
const selectedDirectory = ref('all')
const searchQuery = ref('')
const searching = ref(false)
const searchResults = ref<SearchResult[]>([])
const searchError = ref<string | undefined>(undefined)
const availableTags = ref<string[]>([])
const savedSearches = ref<SavedSearch[]>([])
const cachedIndex = ref<Document<SearchDocument> | undefined>(undefined)
const cachedDocuments = ref<SearchDocument[]>([])
const cachedIndexKey = ref<string | undefined>(undefined)

const extractedTags = computed(() => {
  const tags: string[] = []
  const matches = searchQuery.value.match(/#[\w-]+/g)

  if (matches) {
    matches.forEach((tag) => {
      const cleanTag = tag.substring(1)
      if (cleanTag && !tags.includes(cleanTag)) {
        tags.push(cleanTag)
      }
    })
  }

  return tags
})

const searchText = computed(() => searchQuery.value.replace(/#[\w-]+/g, '').trim())

const isSearchAlreadySaved = computed(() => {
  const currentQuery = searchQuery.value.trim()
  if (!currentQuery) return false
  return savedSearches.value.some((search) => search.name === currentQuery)
})

const loadSavedSearches = async (): Promise<void> => {
  try {
    savedSearches.value = (await window.api.search.getSaved()) as SavedSearch[]
  } catch (error) {
    console.error('Failed to load saved searches:', error)
  }
}

const loadAvailableTags = async (): Promise<void> => {
  const tagsSet = new Set<string>()

  const directoriesToCheck =
    selectedDirectory.value === 'all'
      ? Object.values(directories.value).filter((dir) => dir.exists)
      : [directories.value[selectedDirectory.value]].filter((dir) => dir && dir.exists)

  for (const dir of directoriesToCheck) {
    try {
      const configResult = await window.api.directory.readConfig(dir.path)
      if (configResult.success && configResult.config) {
        if (configResult.config.allTags && Array.isArray(configResult.config.allTags)) {
          configResult.config.allTags.forEach((tag: string) => tagsSet.add(tag))
        } else {
          configResult.config.fileIndex?.forEach((file: { tags?: string[] }) => {
            if (file.tags && Array.isArray(file.tags)) {
              file.tags.forEach((tag) => tagsSet.add(tag))
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading tags from directory:', error)
    }
  }

  availableTags.value = Array.from(tagsSet).sort()
}

const addTag = (tag: string): void => {
  if (!extractedTags.value.includes(tag)) {
    searchQuery.value = `${searchQuery.value} #${tag}`.trim()
  }
}

const removeTag = (tagToRemove: string): void => {
  searchQuery.value = searchQuery.value.replace(new RegExp(`#${tagToRemove}\\b`, 'g'), '').trim()
}

const checkDirectoriesExist = async (): Promise<void> => {
  await window.api.settings.updateAllDirectoryExists()
  directories.value = await window.api.settings.getDirectories()
  directoriesExist.value = Object.values(directories.value).some((dir) => dir.exists === true)
}

const handleExecuteSavedSearch = (event: CustomEvent<string>): void => {
  searchQuery.value = event.detail
  performSearch()
}

const handleDirectoryAdded = async (): Promise<void> => {
  cachedIndex.value = undefined
  cachedDocuments.value = []
  cachedIndexKey.value = undefined
  await checkDirectoriesExist()
  await loadAvailableTags()
}

const parseSearchQuery = (query: string): { exactPhrases: string[]; regularTerms: string[] } => {
  const exactPhrases: string[] = []
  const regularTerms: string[] = []
  const quoteRegex = /"([^"]+)"/g
  let match
  let remainingQuery = query

  while ((match = quoteRegex.exec(query)) !== null) {
    exactPhrases.push(match[1])
    remainingQuery = remainingQuery.replace(match[0], '')
  }

  const terms = remainingQuery
    .trim()
    .split(/\s+/)
    .filter((term) => term.length > 0)

  regularTerms.push(...terms)
  return { exactPhrases, regularTerms }
}

const buildIndexKey = (): string =>
  `${selectedDirectory.value}:${[...extractedTags.value].sort().join(',')}`

const buildSearchIndex = async (): Promise<{ index: Document<SearchDocument>; documents: SearchDocument[] }> => {
  const index = new Document<SearchDocument>({
    tokenize: 'forward',
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

  const documentsToIndex: SearchDocument[] = []

  for (const dir of directoriesToSearch) {
    try {
      const configResult = await window.api.directory.readConfig(dir.path)
      if (!configResult.success || !configResult.config) continue

      const fileIndex = configResult.config.fileIndex || []
      const filteredFiles =
        extractedTags.value.length > 0
          ? fileIndex.filter((file: { tags?: string[] }) => {
              if (!file.tags || !Array.isArray(file.tags)) return false
              return extractedTags.value.some((tag) => file.tags?.includes(tag) ?? false)
            })
          : fileIndex

      for (const file of filteredFiles) {
        const pathParts = file.path.split(/[\\/]/)
        const fileName = pathParts[pathParts.length - 1]
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
        const fileDirectory = pathParts.slice(0, -1).join('/')
        const processedPath = `${fileDirectory}/panopticon-processed/${fileNameWithoutExt}-processed.json`

        try {
          const exists = await window.api.file.exists(processedPath)
          if (!exists) continue

          const jsonContent = await window.api.file.read(processedPath)
          const processedDoc = JSON.parse(jsonContent)

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
          console.error(`Error loading processed JSON for ${file.name}:`, error)
        }
      }
    } catch (error) {
      console.error(`Error loading directory ${dir.path}:`, error)
    }
  }

  if (documentsToIndex.length === 0) {
    throw new Error('No processed documents found to search')
  }

  documentsToIndex.forEach((doc) => index.add(doc))
  return { index, documents: documentsToIndex }
}

const performSearch = async (): Promise<void> => {
  if (!searchText.value.trim() && extractedTags.value.length === 0) {
    return
  }

  searching.value = true
  searchError.value = undefined
  searchResults.value = []

  try {
    const key = buildIndexKey()
    let index: Document<SearchDocument>
    let indexDocuments: SearchDocument[]

    if (cachedIndex.value && cachedIndexKey.value === key) {
      index = cachedIndex.value
      indexDocuments = cachedDocuments.value
    } else {
      const built = await buildSearchIndex()
      index = built.index
      indexDocuments = built.documents
      cachedIndex.value = built.index
      cachedDocuments.value = built.documents
      cachedIndexKey.value = key
    }

    const { exactPhrases, regularTerms } = parseSearchQuery(searchText.value)
    const searchTerms = regularTerms.join(' ')

    const processedResults: SearchResult[] = []

    if (!searchTerms && exactPhrases.length === 0) {
      for (const doc of indexDocuments) {
        processedResults.push({
          filePath: doc.filePath,
          fileName: doc.fileName,
          pageNumber: doc.pageNumber,
          snippet: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          score: 0
        })
      }
    } else {
      const results = await index.searchAsync(searchTerms || searchText.value, {
        limit: 50,
        enrich: true,
        highlight: {
          template: '<mark class="bg-yellow-500/30 text-foreground">$1</mark>',
          clip: false,
          merge: true
        }
      })

      results.forEach((result) => {
        if (!result.result) return

        result.result.forEach((item) => {
          const doc = item.doc
          if (!doc) return

          let matchesExactPhrases = true
          if (exactPhrases.length > 0) {
            const contentLower = doc.content.toLowerCase()
            matchesExactPhrases = exactPhrases.every((phrase) =>
              contentLower.includes(phrase.toLowerCase())
            )
          }

          if (!matchesExactPhrases) return

          const snippet =
            item.highlight || doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : '')

          processedResults.push({
            filePath: doc.filePath,
            fileName: doc.fileName,
            pageNumber: doc.pageNumber,
            snippet,
            score: 0
          })
        })
      })
    }

    searchResults.value = processedResults

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
    searchError.value = error instanceof Error ? error.message : String(error)
  } finally {
    searching.value = false
  }
}

const saveSearch = async (): Promise<void> => {
  if (!searchQuery.value.trim() || isSearchAlreadySaved.value) return

  try {
    await window.api.search.save(searchQuery.value.trim(), searchText.value, extractedTags.value)
    await loadSavedSearches()
    window.dispatchEvent(new CustomEvent('refresh-saved-searches'))
  } catch (error) {
    console.error('Failed to save search:', error)
  }
}

// Flag to ensure event listeners are only registered once
let listenersRegistered = false

export function useSearch() {
  // Lifecycle hooks must be inside the composable function to run in component context
  onMounted(async () => {
    await checkDirectoriesExist()
    await loadAvailableTags()
    await loadSavedSearches()
    
    // Only register event listeners once
    if (!listenersRegistered) {
      window.addEventListener('execute-saved-search', handleExecuteSavedSearch)
      window.addEventListener('directory-added', handleDirectoryAdded)
      listenersRegistered = true
    }
  })

  onActivated(async () => {
    await checkDirectoriesExist()
    await loadAvailableTags()
  })

  onBeforeUnmount(() => {
    // Note: In a singleton pattern with multiple components, we don't remove listeners
    // as they're shared. Only remove if this is the last component using the composable.
  })

  watch(selectedDirectory, () => {
    cachedIndex.value = undefined
    cachedDocuments.value = []
    cachedIndexKey.value = undefined
    loadAvailableTags()
  })

  return {
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
  }
}
