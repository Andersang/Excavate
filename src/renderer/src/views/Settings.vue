<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Directory } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'
import { uiLogger } from '@/utils/logger'

// ----------------------------- State ----------------------------------------
const ocrAvailable = ref<boolean | undefined>(undefined)
const settingsPath = ref('')
const offlineMode = ref(false)
const savingOffline = ref(false)
const directories = ref<Record<string, Directory>>({})
const expandedDir = ref<string | undefined>(undefined)
const dirSaving = ref<Record<string, boolean>>({})
const newExcludePattern = ref<Record<string, string>>({})
const successMsg = ref('')

// ----------------------------- Load -----------------------------------------
onMounted(async () => {
  try {
    const [availability, path, settings] = await Promise.all([
      window.api.document.checkLocalAvailable(),
      window.api.settings.getSettingsPath(),
      window.api.settings.getAll()
    ])
    ocrAvailable.value = availability.available
    settingsPath.value = path
    offlineMode.value = settings.offlineMode ?? false
    directories.value = (settings.directories as Record<string, Directory>) ?? {}
  } catch (error) {
    uiLogger.error('Error loading settings info:', error)
    ocrAvailable.value = false
  }
})

// ----------------------------- Offline mode ---------------------------------
const toggleOfflineMode = async (): Promise<void> => {
  if (savingOffline.value) return
  savingOffline.value = true
  try {
    const next = !offlineMode.value
    await window.api.settings.updateOfflineMode(next)
    offlineMode.value = next
    flash('Offline mode updated')
  } catch (error) {
    uiLogger.error('Failed to update offline mode:', error)
  } finally {
    savingOffline.value = false
  }
}

// ----------------------------- Per-directory --------------------------------
const toggleDir = (id: string): void => {
  expandedDir.value = expandedDir.value === id ? undefined : id
}

const toggleFileType = (id: string, ext: string): void => {
  const dir = directories.value[id]
  if (!dir) return
  const types = dir.settings.fileTypes ?? []
  if (types.includes(ext)) {
    dir.settings.fileTypes = types.filter((t) => t !== ext)
  } else {
    dir.settings.fileTypes = [...types, ext]
  }
}

const addExcludePattern = (id: string): void => {
  const pattern = (newExcludePattern.value[id] ?? '').trim()
  if (!pattern) return
  
  // Validate regex pattern
  try {
    new RegExp(pattern)
  } catch (error) {
    uiLogger.error('Invalid regex pattern:', error)
    // You could show an error message to the user here
    return
  }
  
  const dir = directories.value[id]
  if (!dir) return
  if (!dir.settings.excludePatterns.includes(pattern)) {
    dir.settings.excludePatterns = [...dir.settings.excludePatterns, pattern]
  }
  newExcludePattern.value[id] = ''
}

const removeExcludePattern = (id: string, pattern: string): void => {
  const dir = directories.value[id]
  if (!dir) return
  dir.settings.excludePatterns = dir.settings.excludePatterns.filter((p) => p !== pattern)
}

const saveDirectorySettings = async (id: string): Promise<void> => {
  if (dirSaving.value[id]) return
  dirSaving.value[id] = true
  try {
    const dir = directories.value[id]
    if (!dir) return
    await window.api.settings.updateDirectorySettings(id, dir.settings)
    flash('Directory settings saved')
  } catch (error) {
    uiLogger.error('Failed to save directory settings:', error)
  } finally {
    dirSaving.value[id] = false
  }
}

// ----------------------------- Helpers --------------------------------------
const flash = (msg: string): void => {
  successMsg.value = msg
  setTimeout(() => {
    successMsg.value = ''
  }, 2500)
}

const KNOWN_FILE_TYPES = ['pdf']
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 class="text-3xl font-headers mb-2">Settings</h1>
        <p class="text-muted-foreground">System configuration and preferences</p>
      </div>

      <!-- Flash message -->
      <div
        v-if="successMsg"
        class="text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-4 py-2"
      >
        {{ successMsg }}
      </div>

      <!-- ------------------------------------------------------------------ -->
      <!-- Offline mode                                                         -->
      <!-- ------------------------------------------------------------------ -->
      <section>
        <h2 class="text-xl mb-2 pb-2 border-b border-accent">Network</h2>
        <div class="flex items-center justify-between py-3">
          <div class="flex-1">
            <p class="font-medium">Offline mode</p>
            <p class="text-sm text-muted-foreground mt-0.5">
              Prevent all outbound network requests (update checks, future cloud features)
            </p>
          </div>
          <button
            role="switch"
            :aria-checked="offlineMode"
            :disabled="savingOffline"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            :class="offlineMode ? 'bg-primary' : 'bg-input'"
            @click="toggleOfflineMode"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform"
              :class="offlineMode ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </section>

      <!-- ------------------------------------------------------------------ -->
      <!-- Per-directory settings                                               -->
      <!-- ------------------------------------------------------------------ -->
      <section>
        <h2 class="text-xl mb-2 pb-2 border-b border-accent">Directories</h2>
        <p class="text-sm text-muted-foreground mb-4">
          Configure per-directory file types and exclusion patterns.
        </p>

        <div v-if="Object.keys(directories).length === 0" class="text-sm text-muted-foreground">
          No directories configured yet. Add one in the
          <router-link class="underline" to="/library">Library</router-link>.
        </div>

        <div class="space-y-2">
          <div
            v-for="(dir, id) in directories"
            :key="id"
            class="border border-accent rounded-lg overflow-hidden"
          >
            <!-- Header row -->
            <button
              class="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              @click="toggleDir(id)"
            >
              <span class="font-medium">{{ dir.name }}</span>
              <span class="text-xs text-muted-foreground">{{
                expandedDir === id ? '▲' : '▼'
              }}</span>
            </button>

            <!-- Expanded panel -->
            <div v-if="expandedDir === id" class="px-4 pb-4 space-y-5 bg-accent/20">
              <!-- File types -->
              <div class="space-y-2 pt-3">
                <p class="text-sm font-medium">Indexed file types</p>
                <div class="flex gap-4 flex-wrap">
                  <label
                    v-for="ext in KNOWN_FILE_TYPES"
                    :key="ext"
                    class="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded border-input"
                      :checked="dir.settings.fileTypes?.includes(ext)"
                      @change="toggleFileType(id, ext)"
                    />
                    <span class="text-sm">.{{ ext }}</span>
                  </label>
                </div>
              </div>

              <!-- Exclusion patterns -->
              <div class="space-y-2">
                <p class="text-sm font-medium">Exclusion patterns</p>
                <div v-if="dir.settings.excludePatterns?.length" class="flex flex-wrap gap-2 mb-2">
                  <span
                    v-for="pattern in dir.settings.excludePatterns"
                    :key="pattern"
                    class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-accent rounded-md"
                  >
                    {{ pattern }}
                    <button
                      class="hover:text-destructive transition-colors"
                      @click="removeExcludePattern(id, pattern)"
                    >
                      ×
                    </button>
                  </span>
                </div>
                <div class="flex gap-2">
                  <Input
                    v-model="newExcludePattern[id]"
                    placeholder="e.g. archive/**"
                    class="flex-1 h-8 text-sm"
                    @keypress.enter="addExcludePattern(id)"
                  />
                  <Button variant="outline" size="sm" @click="addExcludePattern(id)">Add</Button>
                </div>
              </div>

              <!-- Save button -->
              <div class="flex justify-end">
                <Button size="sm" :disabled="dirSaving[id]" @click="saveDirectorySettings(id)">
                  {{ dirSaving[id] ? 'Saving...' : 'Save' }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------------------------------ -->
      <!-- OCR Engine Status                                                    -->
      <!-- ------------------------------------------------------------------ -->
      <section>
        <h2 class="text-xl mb-2 pb-2 border-b border-accent">OCR Engine</h2>
        <p class="text-sm text-muted-foreground mb-4">
          Built-in document processing — no external dependencies required
        </p>

        <div class="flex items-center justify-between pb-4 bg-background rounded-md">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium">tesseract.js + PDFium</span>
              <span
                class="text-xl"
                :class="
                  ocrAvailable === undefined
                    ? 'text-muted-foreground'
                    : ocrAvailable
                      ? 'text-green-500'
                      : 'text-destructive'
                "
              >
                {{ ocrAvailable === undefined ? '...' : ocrAvailable ? '✓' : '✗' }}
              </span>
            </div>
            <div class="text-sm text-muted-foreground mt-1">
              <span v-if="ocrAvailable === undefined">Checking availability...</span>
              <span v-else-if="ocrAvailable">Ready — OCR engine is fully operational</span>
              <span v-else class="text-destructive">OCR engine unavailable</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ------------------------------------------------------------------ -->
      <!-- Configuration                                                        -->
      <!-- ------------------------------------------------------------------ -->
      <section>
        <h2 class="text-xl mb-2 pb-2 border-b border-accent">Configuration</h2>
        <div class="space-y-2">
          <p class="text-sm font-medium">Settings file location:</p>
          <code
            class="block bg-background border border-accent rounded-md p-3 text-sm font-mono overflow-x-auto"
          >
            {{ settingsPath || 'Loading...' }}
          </code>
        </div>
      </section>
    </div>
  </ScrollArea>
</template>
