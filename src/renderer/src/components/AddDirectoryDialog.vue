<script setup lang="ts">
import { ref } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'directory-added'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedPath = ref<string>('')
const directoryName = ref<string>('')
const fileTypes = ref({
  pdf: true
})
const isProcessing = ref(false)
const error = ref<string>('')

const browseDirectory = async () => {
  const path = await window.api.dialog.openDirectory()
  if (path) {
    selectedPath.value = path
    // Extract directory name from path
    const parts = path.split(/[/\\]/)
    directoryName.value = parts[parts.length - 1]
    error.value = ''
  }
}

const handleAdd = async () => {
  if (!selectedPath.value) {
    error.value = 'Please select a directory'
    return
  }

  const selectedFileTypes = Object.entries(fileTypes.value)
    .filter(([_, enabled]) => enabled)
    .map(([type]) => type)

  if (selectedFileTypes.length === 0) {
    error.value = 'Please select at least one file type'
    return
  }

  isProcessing.value = true
  error.value = ''

  try {
    // Add directory to settings (don't create config file yet - that happens during indexing)
    const id = crypto.randomUUID()
    await window.api.settings.addDirectory(id, {
      path: selectedPath.value,
      name: directoryName.value,
      addedAt: new Date().toISOString(),
      exists: true,
      settings: {
        watchForChanges: true, // Enable auto-watching by default
        excludePatterns: [],
        fileTypes: selectedFileTypes
      },
      lastAccessed: new Date().toISOString()
    })

    // Reset form and close
    selectedPath.value = ''
    directoryName.value = ''
    fileTypes.value = { pdf: true }
    emit('update:open', false)
    emit('directory-added')

    // Dispatch global event for other views to listen
    window.dispatchEvent(new CustomEvent('directory-added'))
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isProcessing.value = false
  }
}

const handleCancel = () => {
  selectedPath.value = ''
  directoryName.value = ''
  fileTypes.value = { pdf: true }
  error.value = ''
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add Directory</DialogTitle>
        <DialogDescription>
          Add a directory to your library. Select the file types you want to index when scanning
          this directory.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Directory Selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Directory</label>
          <div class="flex gap-2">
            <Input
              v-model="selectedPath"
              placeholder="No directory selected"
              readonly
              class="flex-1"
            />
            <Button @click="browseDirectory" variant="outline">Browse</Button>
          </div>
          <p v-if="selectedPath" class="text-sm text-muted-foreground">Name: {{ directoryName }}</p>
        </div>

        <!-- File Types Selection -->
        <div class="space-y-2">
          <label class="text-sm font-medium">File Types to Process</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="fileTypes.pdf" type="checkbox" class="w-4 h-4 rounded border-input" />
              <span class="text-sm">PDF (.pdf)</span>
            </label>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="text-sm text-red-500">
          {{ error }}
        </div>
      </div>

      <DialogFooter>
        <Button @click="handleCancel" variant="outline" :disabled="isProcessing"> Cancel </Button>
        <Button @click="handleAdd" :disabled="isProcessing">
          {{ isProcessing ? 'Adding...' : 'Add Directory' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
