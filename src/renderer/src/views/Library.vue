<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated } from 'vue'
import type { Directory } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import AddDirectoryDialog from '@/components/AddDirectoryDialog.vue'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'
import embedPDFMain from '@renderer/components/EmbedPDFUI/embedPDFMain.vue'
import FileList from '@/components/FileList.vue'
import { usePdfViewer } from '@/composables/usePdfViewer'
import { indexLogger, uiLogger } from '@/utils/logger'
import { emitDirectoryUpdated } from '@/utils/appEvents'
import { formatDate } from '@/utils/format'

interface DirectoryWithFileCount extends Directory {
  fileCount?: number
  isIndexed: boolean
}

const directories = ref<Record<string, Directory>>({})
const directoriesWithCounts = ref<Record<string, DirectoryWithFileCount>>({})
const loading = ref(true)
const showAddDialog = ref(false)
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

const indexingDirectories = ref<Set<string>>(new Set())
const indexingAll = ref(false)
const selectedDirectoryId = ref<string | undefined>(undefined)
const selectedDirectoryFiles = ref<FileItem[]>([])
const loadingFiles = ref(false)
const availableTags = ref<string[]>([])
const selectedFileId = ref<string | undefined>(undefined) // Track selected file for bookmarks

// Confirmation dialog state
interface ConfirmDialogState {
  open: boolean
  title: string
  message: string
  onConfirm: () => void | Promise<void>
}
const confirmDialogState = ref<ConfirmDialogState>({
  open: false,
  title: '',
  message: '',
  onConfirm: () => {}
})
const notificationMessage = ref<{ type: 'error' | 'success'; text: string } | undefined>(undefined)

const openConfirm = (
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>
): void => {
  confirmDialogState.value = { open: true, title, message, onConfirm }
}
const handleConfirm = async (): Promise<void> => {
  confirmDialogState.value.open = false
  await confirmDialogState.value.onConfirm()
}
const clearNotification = (): void => {
  notificationMessage.value = undefined
}

// Use PDF Viewer composable
const {
  selectedPdfPath,
  selectedPdfPage,
  isOwnPdfViewer,
  pdfPanelWidth,
  isResizing,
  searchPanelWidth,
  openPdf,
  closePdfViewer,
  startResize
} = usePdfViewer('library')

// Handler to open PDF from file list
const openPdfFromFile = (file: FileItem): void => {
  if (file.exists && (file.extension === '.pdf' || file.extension === 'pdf')) {
    selectedFileId.value = file.id
    openPdf(file.path, 1)
  }
}

// Handler to close PDF viewer
const handleClosePdfViewer = (): void => {
  selectedFileId.value = undefined
  closePdfViewer()
}

// Named handler so it can be removed in onUnmounted
const handleDirectoryAddedEvent = async (): Promise<void> => {
  await loadDirectories()
}

// Named handler so it can be unregistered in onUnmounted
const handleDirectoryUpdatedEvent = (
  event: CustomEvent<{ directoryId: string; fileCount: number }>
): void => {
  const { directoryId, fileCount } = event.detail
  uiLogger.info(`Directory ${directoryId} updated: ${fileCount} files`)
  if (directoriesWithCounts.value[directoryId]) {
    directoriesWithCounts.value[directoryId].fileCount = fileCount
    directoriesWithCounts.value[directoryId].isIndexed = true
  }
}

onMounted(async () => {
  await loadDirectories()

  // IPC push from main process — bridge to typed window event so all
  // update listeners use the same window event system.
  window.api.directory.onDirectoryUpdated(({ directoryId, fileCount }) => {
    emitDirectoryUpdated(directoryId, fileCount)
  })

  window.addEventListener('directory-updated', handleDirectoryUpdatedEvent)
  window.addEventListener('directory-added', handleDirectoryAddedEvent)
})

onUnmounted(() => {
  window.removeEventListener('directory-updated', handleDirectoryUpdatedEvent)
  window.removeEventListener('directory-added', handleDirectoryAddedEvent)
})

// Reclaim PDF viewer ownership when returning to this view
onActivated(() => {
  if (selectedPdfPath.value && selectedPdfPage.value) {
    uiLogger.debug('Reclaiming PDF viewer ownership')
    openPdf(selectedPdfPath.value, selectedPdfPage.value)
  }
})

const loadDirectories = async (): Promise<void> => {
  loading.value = true
  try {
    await window.api.settings.updateAllDirectoryExists()
    directories.value = await window.api.settings.getDirectories()

    // Load file counts for each directory
    const dirsWithCounts: Record<string, DirectoryWithFileCount> = {}

    for (const [id, dir] of Object.entries(directories.value)) {
      const dirWithCount: DirectoryWithFileCount = {
        ...dir,
        fileCount: undefined,
        isIndexed: false
      }

      if (dir.exists) {
        try {
          const result = await window.api.directory.readConfig(dir.path)
          if (result.success && result.config) {
            dirWithCount.fileCount = result.config.fileCount
            dirWithCount.isIndexed = true
          }
        } catch (error) {
          indexLogger.warn(`Could not read config for ${dir.name}:`, error)
        }
      }

      dirsWithCounts[id] = dirWithCount
    }

    directoriesWithCounts.value = dirsWithCounts
  } finally {
    loading.value = false
  }
}

const addDirectory = (): void => {
  showAddDialog.value = true
}

const handleDirectoryAdded = async (directoryId?: string): Promise<void> => {
  await loadDirectories()

  // Auto-index the newly added directory
  if (directoryId && directories.value[directoryId]) {
    await indexDirectory(directoryId, directories.value[directoryId])
  }
}

const indexDirectory = async (id: string, directory: Directory): Promise<void> => {
  if (!directory.exists) return

  indexingDirectories.value.add(id)
  try {
    // Extract primitive values to avoid passing reactive proxies
    const directoryPath = directory.path
    const fileTypes = [...(directory.settings.fileTypes || ['pdf', 'markdown', 'md'])]

    const result = await window.api.directory.index(directoryPath, fileTypes)

    if (result.success) {
      if (result.isFirstScan) {
        indexLogger.info(`📂 ${directory.name}: Indexed ${result.fileCount} files`)
      } else if (result.changes) {
        const { added, modified, removed } = result.changes
        indexLogger.info(
          `📂 ${directory.name}: ${result.fileCount} files (+${added} ~${modified} -${removed})`
        )
      }
      // Reload directories to update file count
      await loadDirectories()
    } else {
      indexLogger.error('Index failed:', result.error)
    }
  } catch (error) {
    indexLogger.error('Index error:', error)
  } finally {
    indexingDirectories.value.delete(id)
  }
}

const indexAllDirectories = async (): Promise<void> => {
  const existingDirectories = Object.entries(directories.value).filter(([, dir]) => dir.exists)

  if (existingDirectories.length === 0) return

  indexingAll.value = true
  let successCount = 0

  try {
    // Index each directory sequentially
    for (const [, dir] of existingDirectories) {
      try {
        const fileTypes = dir.settings.fileTypes || ['pdf', 'markdown', 'md']
        const result = await window.api.directory.index(dir.path, fileTypes)
        if (result.success) {
          successCount++
          if (result.isFirstScan) {
            indexLogger.info(`📂 ${dir.name}: Indexed ${result.fileCount} files`)
          } else {
            const { added, modified, removed } = result.changes || {
              added: 0,
              modified: 0,
              removed: 0
            }
            indexLogger.info(
              `📂 ${dir.name}: ${result.fileCount} files (+${added} ~${modified} -${removed})`
            )
          }
        } else {
          indexLogger.error(`❌ ${dir.name}: ${result.error}`)
        }
      } catch (error) {
        indexLogger.error(`❌ ${dir.name}:`, error)
      }
    }

    indexLogger.info(
      `Successfully indexed ${successCount}/${existingDirectories.length} directories`
    )
    // Reload directories to update file counts
    await loadDirectories()
  } catch (error) {
    indexLogger.error('Index all error:', error)
  } finally {
    indexingAll.value = false
  }
}

const removeDirectory = (id: string): void => {
  openConfirm(
    'Remove Directory',
    'Are you sure you want to remove this directory from the library?',
    async () => {
      await window.api.settings.removeDirectory(id)
      await loadDirectories()
    }
  )
}


const selectDirectory = async (id: string, directory: Directory): Promise<void> => {
  if (!directory.exists) return

  selectedDirectoryId.value = id
  loadingFiles.value = true
  selectedDirectoryFiles.value = []

  try {
    const result = await window.api.directory.readConfig(directory.path)
    if (result.success && result.config) {
      // Load available tags from config
      availableTags.value = result.config.allTags || []

      const files = await Promise.all(
        (result.config.fileIndex || []).map(async (f) => {
          // Check if file has been processed by checking for JSON file
          const { isProcessed, processingMethod } = await checkIfProcessed(f.path)
          return {
            ...f,
            checked: false,
            isProcessed,
            processingMethod
          }
        })
      )
      selectedDirectoryFiles.value = files
    } else {
      uiLogger.error('Failed to load directory files:', result.error)
    }
  } catch (error) {
    uiLogger.error('Error loading directory files:', error)
  } finally {
    loadingFiles.value = false
  }
}

const refreshFileList = async (): Promise<void> => {
  if (!selectedDirectoryId.value) return

  const directory = directories.value[selectedDirectoryId.value]
  if (!directory) return

  await selectDirectory(selectedDirectoryId.value, directory)
}

const updateFileTags = async (fileId: string, tags: string[]): Promise<void> => {
  if (!selectedDirectoryId.value) return

  const directory = directories.value[selectedDirectoryId.value]
  if (!directory) return

  try {
    // Convert to plain array to avoid reactive proxy cloning errors
    const plainTags = [...tags]

    const result = await window.api.directory.updateFileTags(directory.path, fileId, plainTags)
    if (result.success) {
      // Use sanitized tags from backend response
      const sanitizedTags = result.tags || plainTags
      // Update local state with sanitized tags
      selectedDirectoryFiles.value = selectedDirectoryFiles.value.map((f) =>
        f.id === fileId ? { ...f, tags: sanitizedTags } : f
      )

      // Reload available tags from config to get updated allTags list
      const configResult = await window.api.directory.readConfig(directory.path)
      if (configResult.success && configResult.config) {
        availableTags.value = configResult.config.allTags || []
      }
    } else {
      uiLogger.error('Failed to update tags:', result.error)
      notificationMessage.value = { type: 'error', text: `Failed to update tags: ${result.error}` }
    }
  } catch (error) {
    uiLogger.error('Error updating tags:', error)
    notificationMessage.value = { type: 'error', text: 'Error updating tags.' }
  }
}

const checkIfProcessed = async (
  filePath: string
): Promise<{ isProcessed: boolean; processingMethod?: 'local' }> => {
  try {
    // Extract directory and filename
    const pathParts = filePath.split(/[\\/]/)
    const fileName = pathParts[pathParts.length - 1]
    const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
    const directory = pathParts.slice(0, -1).join('/')

    // Check if processed JSON exists
    const processedPath = `${directory}/panopticon-processed/${fileNameWithoutExt}-processed.json`
    const exists = await window.api.file.exists(processedPath)

    if (!exists) {
      return { isProcessed: false }
    }

    // Read the JSON to get the processing method
    try {
      const jsonContent = await window.api.file.read(processedPath)
      const data = JSON.parse(jsonContent)
      return {
        isProcessed: true,
        processingMethod: data.processingMethod || 'local'
      }
    } catch (error) {
      uiLogger.warn('Error reading processed JSON:', error)
      return { isProcessed: true } // File exists but couldn't read it
    }
  } catch (error) {
    uiLogger.error('Error checking if file is processed:', error)
    return { isProcessed: false }
  }
}

const closeFileList = (): void => {
  selectedDirectoryId.value = undefined
  selectedDirectoryFiles.value = []
}

const toggleFileSelection = (file: FileItem): void => {
  // Trigger reactivity by reassigning the array
  selectedDirectoryFiles.value = selectedDirectoryFiles.value.map((f) =>
    f.id === file.id ? { ...f, checked: !f.checked } : f
  )
}

const toggleSelectAll = (checked: boolean | 'indeterminate'): void => {
  // Set all existing files to the checkbox state (ignore indeterminate)
  const checkedValue = checked === true
  selectedDirectoryFiles.value = selectedDirectoryFiles.value.map((f) => {
    if (f.exists) {
      return { ...f, checked: checkedValue }
    }
    return f
  })
}

// const isAllSelected = (): boolean => {
//   const existingFiles = selectedDirectoryFiles.value.filter((f) => f.exists)
//   return existingFiles.length > 0 && existingFiles.every((f) => f.checked)
// }

const getSelectedFiles = (): FileItem[] => {
  return selectedDirectoryFiles.value.filter((f) => f.checked && f.exists)
}

// Check if any selected files are already processed
// const hasProcessedFiles = (): boolean => {
//   return getSelectedFiles().some((f) => f.isProcessed)
// }

const deleteSelectedFiles = (): void => {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) return

  openConfirm(
    'Delete Files',
    `Are you sure you want to delete ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}? This cannot be undone.`,
    async () => {
      try {
        const dir = directoriesWithCounts.value[selectedDirectoryId.value!]
        const filePaths = selectedFiles.map((f) => f.path)
        const result = await window.api.directory.deleteFiles(dir.path, filePaths)

        if (result.success) {
          uiLogger.info(`Deleted ${result.deletedCount} files`)
          if (dir) await selectDirectory(selectedDirectoryId.value!, dir)
        } else {
          uiLogger.error('Failed to delete files:', result.error)
          notificationMessage.value = {
            type: 'error',
            text: 'Failed to delete some files. Check the logs for details.'
          }
        }
      } catch (error) {
        uiLogger.error('Error deleting files:', error)
        notificationMessage.value = {
          type: 'error',
          text: 'An error occurred while deleting files.'
        }
      }
    }
  )
}

const deleteSingleFile = (file: FileItem): void => {
  openConfirm(
    'Delete File',
    `Are you sure you want to delete "${file.name}"? This cannot be undone.`,
    async () => {
      try {
        const dir = directoriesWithCounts.value[selectedDirectoryId.value!]
        const result = await window.api.directory.deleteFiles(dir.path, [file.path])

        if (result.success) {
          uiLogger.info(`Deleted file: ${file.name}`)
          if (dir) await selectDirectory(selectedDirectoryId.value!, dir)
        } else {
          uiLogger.error('Failed to delete file:', result.error)
          notificationMessage.value = { type: 'error', text: 'Failed to delete file.' }
        }
      } catch (error) {
        uiLogger.error('Error deleting file:', error)
        notificationMessage.value = {
          type: 'error',
          text: 'An error occurred while deleting the file.'
        }
      }
    }
  )
}

const processingFiles = ref<Set<string>>(new Set())

// Helper function to chunk array into smaller batches
const chunk = <T,>(array: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

const processSelectedFiles = (): void => {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) return

  const processedCount = selectedFiles.filter((f) => f.isProcessed).length
  const unprocessedCount = selectedFiles.length - processedCount

  let confirmMessage = ''
  if (processedCount > 0 && unprocessedCount > 0) {
    confirmMessage = `Process ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}?\n\n${unprocessedCount} will be processed, ${processedCount} will be re-processed.`
  } else if (processedCount > 0) {
    confirmMessage = `Re-process ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}?`
  } else {
    confirmMessage = `Process ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}?`
  }

  openConfirm('Process Files', confirmMessage, async () => {
    uiLogger.info(
      'Processing files:',
      selectedFiles.map((f) => f.name)
    )

    let successCount = 0
    let failCount = 0

    const CONCURRENCY = 3
    const batches = chunk(selectedFiles, CONCURRENCY)

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (file) => {
          processingFiles.value.add(file.id)

          try {
            if (file.isProcessed) {
              uiLogger.debug(`Deleting existing processed file for: ${file.name}`)
              const dir = file.path.replace(/[\\/][^\\/]+$/, '')
              const fileName = file.path.replace(/.*[\\/]/, '')
              const fileNameWithoutExt =
                fileName.substring(0, fileName.lastIndexOf('.')) || fileName
              const sep = file.path.includes('\\') ? '\\' : '/'
              const processedPath = `${dir}${sep}panopticon-processed${sep}${fileNameWithoutExt}-processed.json`
              try {
                await window.api.file.delete(processedPath)
              } catch (deleteError) {
                uiLogger.warn(`Could not delete existing processed file: ${deleteError}`)
              }
            }

            uiLogger.debug(`Processing: ${file.name}`)
            const result = await window.api.document.process(file.path)

            if (result.success) {
              uiLogger.info(`✓ Processed: ${file.name}`)
              successCount++
              const { isProcessed, processingMethod } = await checkIfProcessed(file.path)
              selectedDirectoryFiles.value = selectedDirectoryFiles.value.map((f) =>
                f.id === file.id ? { ...f, isProcessed, processingMethod } : f
              )
            } else {
              uiLogger.error(`✗ Failed to process ${file.name}:`, result.error)
              failCount++
            }
          } catch (error) {
            uiLogger.error(`Error processing ${file.name}:`, error)
            failCount++
          } finally {
            processingFiles.value.delete(file.id)
          }
        })
      )
    }

    if (failCount === 0) {
      notificationMessage.value = {
        type: 'success',
        text: `Processing complete — ${successCount} file${successCount !== 1 ? 's' : ''} processed.`
      }
    } else {
      notificationMessage.value = {
        type: 'error',
        text: `Processing complete with errors. Successful: ${successCount}, Failed: ${failCount}.`
      }
    }
  })
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <!-- Notification banner -->
    <div
      v-if="notificationMessage"
      :class="[
        'flex items-center justify-between px-4 py-2 text-sm shrink-0',
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
    <!-- When NO PDF is open OR no directory selected: Show directories and files side by side -->
    <div
      v-if="!isOwnPdfViewer || !selectedDirectoryId"
      class="flex-1 flex flex-col overflow-hidden"
    >
      <div class="flex flex-wrap items-center justify-between gap-4 p-6 shrink-0">
        <div class="min-w-0">
          <h1 class="truncate">Library</h1>
          <p class="text-sm text-muted-foreground mt-1 truncate">
            Manage directories to index and search
          </p>
        </div>
        <div v-if="Object.keys(directories).length > 0" class="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" @click="loadDirectories"> ↻ </Button>
          <Button variant="outline" size="sm" :disabled="indexingAll" @click="indexAllDirectories">
            {{ indexingAll ? '↻ Indexing...' : 'Index All' }}
          </Button>
          <Button size="sm" @click="addDirectory"> + Add </Button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <p class="text-muted-foreground">Loading directories...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="Object.keys(directories).length === 0"
        class="flex-1 flex items-center justify-center p-8"
      >
        <div class="text-center max-w-md space-y-6">
          <div class="text-6xl text-muted-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="96"
              height="96"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="mx-auto"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <div class="space-y-2">
            <h2 class="">No Directories Added</h2>
            <p class="text-muted-foreground">
              Add directories containing PDFs and documents to start building your searchable
              library.
            </p>
          </div>
          <Button class="mt-4" size="lg" @click="addDirectory">+ Add Your First Directory</Button>
        </div>
      </div>

      <!-- Directories and Files -->
      <div v-else class="flex-1 flex p-6 gap-6 min-h-0 overflow-hidden">
        <ScrollArea :class="selectedDirectoryId ? 'w-1/2' : 'w-full'">
          <div class="flex flex-col gap-4 p-4">
            <div
              v-for="(dir, id) in directoriesWithCounts"
              :key="id"
              :class="[
                'group border rounded-lg p-4 transition-colors cursor-pointer',
                dir.exists
                  ? 'bg-accent/30 border-accent hover:bg-accent/50'
                  : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
                selectedDirectoryId === id ? 'ring-2 ring-primary' : ''
              ]"
              @click="selectDirectory(id as string, dir)"
            >
              <div class="flex items-start justify-between gap-4">
                <!-- Directory Info -->
                <div class="flex-1 min-w-0 overflow-hidden">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="truncate">{{ dir.name }}</h3>
                    <span
                      v-if="!dir.exists"
                      class="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 rounded shrink-0"
                    >
                      Missing
                    </span>
                  </div>
                  <p class="text-sm text-muted-foreground font-mono truncate">
                    {{ dir.path }}
                  </p>

                  <!-- File Count -->
                  <div class="mt-2 text-sm">
                    <span v-if="!dir.exists" class="text-muted-foreground italic">
                      Directory missing
                    </span>
                    <span v-else-if="!dir.isIndexed" class="text-muted-foreground italic">
                      Not indexed
                    </span>
                    <span v-else class="font-medium">
                      {{ dir.fileCount }} {{ dir.fileCount === 1 ? 'file' : 'files' }}
                    </span>
                  </div>

                  <div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Added {{ formatDate(dir.addedAt) }}</span>
                    <span>•</span>
                    <span>Last accessed {{ formatDate(dir.lastAccessed) }}</span>
                    <span v-if="dir.settings.watchForChanges" class="flex items-center gap-1">
                      <span>•</span>
                      <span>◉ Watching</span>
                    </span>
                  </div>
                </div>

                <!-- Actions -->
                <div
                  class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click.stop
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="sm" class="h-8 w-8 p-0"> ⋮ </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        v-if="dir.exists"
                        :disabled="indexingDirectories.has(id as string)"
                        @click="indexDirectory(id as string, dir)"
                      >
                        {{
                          indexingDirectories.has(id as string) ? 'Indexing...' : 'Index Directory'
                        }}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-red-500 focus:text-red-500"
                        @click="removeDirectory(id as string)"
                      >
                        Remove Directory
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <!-- File List Panel -->
        <div v-if="selectedDirectoryId" class="border-l w-1/2 flex flex-col">
          <FileList
            :files="selectedDirectoryFiles"
            :loading="loadingFiles"
            :available-tags="availableTags"
            :processing-files="processingFiles"
            :show-header="true"
            header-title="Files"
            @file-click="openPdfFromFile"
            @toggle-selection="toggleFileSelection"
            @toggle-select-all="toggleSelectAll"
            @delete-selected="deleteSelectedFiles"
            @delete-file="deleteSingleFile"
            @process-selected="processSelectedFiles"
            @update-tags="updateFileTags"
            @refresh="refreshFileList"
            @close="closeFileList"
          />
        </div>
      </div>
    </div>

    <!-- When PDF IS open: Show file list on left, PDF viewer on right -->
    <div v-if="isOwnPdfViewer && selectedDirectoryId" class="flex-1 flex h-full overflow-hidden">
      <!-- File List (left side) -->
      <div
        class="file-list-panel flex flex-col border-r overflow-hidden"
        :style="{ width: `${searchPanelWidth}%`, height: '100%' }"
      >
        <FileList
          :files="selectedDirectoryFiles"
          :loading="loading"
          :available-tags="availableTags"
          :selected-file-path="selectedPdfPath || undefined"
          :processing-files="processingFiles"
          :show-header="true"
          header-title="Files"
          :header-subtitle="
            selectedDirectoryId && directories[selectedDirectoryId]
              ? `in ${directories[selectedDirectoryId].name}`
              : ''
          "
          @file-click="openPdfFromFile"
          @toggle-selection="toggleFileSelection"
          @toggle-select-all="toggleSelectAll"
          @delete-selected="deleteSelectedFiles"
          @delete-file="deleteSingleFile"
          @process-selected="processSelectedFiles"
          @update-tags="updateFileTags"
          @refresh="refreshFileList"
          @close="handleClosePdfViewer"
        />
      </div>

      <!-- Resizer -->
      <div class="resizer" :class="{ resizing: isResizing }" @mousedown="startResize"></div>

      <!-- PDF Viewer (right side) -->
      <div class="pdf-viewer-panel h-full overflow-hidden" :style="{ width: `${pdfPanelWidth}%` }">
        <embedPDFMain
          v-show="isOwnPdfViewer && selectedPdfPath"
          :key="`library-${selectedPdfPath}`"
          :file-path="selectedPdfPath || undefined"
          :initial-page="selectedPdfPage || 1"
          view-source="library"
        />
      </div>
    </div>
  </div>

  <!-- Add Directory Dialog -->
  <AddDirectoryDialog
    :open="showAddDialog"
    @update:open="(val) => (showAddDialog = val)"
    @directory-added="(id: string) => handleDirectoryAdded(id)"
  />

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
