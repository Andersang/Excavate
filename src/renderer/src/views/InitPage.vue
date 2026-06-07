<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'

const settingsPath = ref('')
const router = useRouter()
const isInitializing = ref(false)

onMounted(async () => {
  // Guard: if settings already exist, skip the init page entirely
  const exists = await window.api.settings.settingsFileExists()
  if (exists) {
    await router.replace('/')
    return
  }
  settingsPath.value = await window.api.settings.getSettingsPath()
})

const createDefaultSettings = async (): Promise<void> => {
  if (isInitializing.value) return
  isInitializing.value = true
  try {
    await window.api.settings.createDefaultSettings(true)
    window.dispatchEvent(new CustomEvent('settings-created'))
    await router.push('/')
  } finally {
    isInitializing.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <ScrollArea class="flex-1">
      <div class="flex items-center justify-center p-8 pt-8 min-h-full">
        <div class="max-w-2xl w-full space-y-8">
          <!-- Header -->
          <div class="text-center space-y-3">
            <h1>Welcome to Excavate</h1>
            <p class="text-xl text-muted-foreground">
              Your offline-first document search companion
            </p>
          </div>

          <!-- Main Content Card -->
          <div class="bg-accent/30 rounded-lg p-8 space-y-6 border border-accent">
            <div class="space-y-4">
              <p class="leading-relaxed">
                Excavate helps you search through PDFs and other documents with powerful OCR and
                indexing capabilities.
              </p>

              <!-- OCR Engine Info -->
              <div class="space-y-3">
                <p class="text-sm font-semibold">Processing Engine</p>
                <div class="flex items-center gap-2 p-3 bg-background/50 rounded-md">
                  <div class="w-2 h-2 rounded-full shrink-0 bg-green-500"></div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-medium">tesseract.js + PDFium</span>
                    <span class="text-xs text-muted-foreground">
                      Built-in OCR — no external dependencies required
                    </span>
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <p class="text-sm font-semibold">First Time Setup</p>
                <p class="text-sm text-muted-foreground">
                  A settings file will be created in your Documents folder to get you started.
                </p>
              </div>

              <div class="space-y-2">
                <p class="text-sm font-medium">Settings location:</p>
                <code
                  class="block bg-background border border-accent rounded-md p-3 text-sm font-mono overflow-x-auto"
                >
                  {{ settingsPath || 'Loading...' }}
                </code>
              </div>

              <p class="text-sm text-muted-foreground">
                You can customize your settings later from the application menu.
              </p>
            </div>

            <!-- Action Button -->
            <div class="flex justify-center">
              <button
                class="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="isInitializing"
                @click="createDefaultSettings()"
              >
                {{ isInitializing ? 'Setting up...' : "Let's Go!" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
