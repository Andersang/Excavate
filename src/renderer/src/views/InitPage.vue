<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ScrollArea from '@renderer/components/ui/scroll-area/ScrollArea.vue'

interface SystemDependency {
  name: string
  version?: string
  isInstalled: boolean
  isValidVersion?: boolean
  requiredVersion?: string
  architecture?: string
  error?: string
}

const settingsPath = ref('')
const pythonStatus = ref<SystemDependency | null>(null)
const tesseractStatus = ref<SystemDependency | null>(null)
const ghostscriptStatus = ref<SystemDependency | null>(null)
const systemCheckLoading = ref(true)
const venvSetupLoading = ref(false)
const venvSetupComplete = ref(false)
const venvSetupError = ref('')
const venvSetupLogs = ref<string[]>([])

onMounted(async () => {
  settingsPath.value = await window.api.settings.getSettingsPath()
  await checkSystemDependencies()
  await checkVenvStatus()

  // Listen for venv setup progress
  window.api.python.onSetupProgress((message: string) => {
    venvSetupLogs.value.push(message)
  })
})

const checkSystemDependencies = async (): Promise<void> => {
  systemCheckLoading.value = true
  try {
    pythonStatus.value = await window.api.getPythonStatus()
    tesseractStatus.value = await window.api.getTesseractStatus()
    ghostscriptStatus.value = await window.api.getGhostscriptStatus()
  } finally {
    systemCheckLoading.value = false
  }
}

const checkVenvStatus = async (): Promise<void> => {
  try {
    const status = await window.api.python.checkVenvStatus()
    venvSetupComplete.value = status.exists && status.hasOcrmypdf
  } catch (error) {
    console.error('Error checking venv status:', error)
  }
}

const allDependenciesMet = (): boolean => {
  return !!(
    pythonStatus.value?.isInstalled &&
    pythonStatus.value?.isValidVersion &&
    tesseractStatus.value?.isInstalled &&
    ghostscriptStatus.value?.isInstalled
  )
}

const setupVenv = async (): Promise<void> => {
  venvSetupLoading.value = true
  venvSetupError.value = ''
  venvSetupLogs.value = []

  try {
    const result = await window.api.python.setupEnvironment()
    if (result.success) {
      venvSetupComplete.value = true
    } else {
      venvSetupError.value = result.error || 'Failed to setup Python environment'
    }
  } catch (error) {
    venvSetupError.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    venvSetupLoading.value = false
  }
}

const createDefaultSettings = async (): Promise<void> => {
  await window.api.settings.createDefaultSettings(true)
  // Reload the page to show the main interface
  location.reload()
}
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <ScrollArea class="flex-1">
      <div class="flex items-center justify-center p-8 pt-8 min-h-full">
        <div class="max-w-2xl w-full space-y-8">
          <!-- Header -->
          <div class="text-center space-y-3">
            <h1>Welcome to Panopticon</h1>
            <p class="text-xl text-muted-foreground">
              Your offline-first document search companion
            </p>
          </div>

          <!-- Main Content Card -->
          <div class="bg-accent/30 rounded-lg p-8 space-y-6 border border-accent">
            <div class="space-y-4">
          <p class="leading-relaxed">
            Panopticon helps you search through PDFs and other documents with powerful OCR and
            indexing capabilities.
          </p>

          <!-- Mode Selection -->
          <div class="space-y-3">
            <p class="text-sm font-semibold">Processing Mode</p>
            <p class="text-xs text-muted-foreground">
              Panopticon processes documents locally using Python, Tesseract, and Ghostscript. No internet required.
            </p>
          </div>

          <!-- System Requirements Check -->
          <div class="space-y-3">
            <p class="text-sm font-semibold">System Requirements</p>

            <div v-if="systemCheckLoading" class="text-sm text-muted-foreground">
              Checking system dependencies...
            </div>

            <div v-else class="grid grid-cols-3 gap-2">
              <!-- Python Status -->
              <div class="flex items-center gap-2 p-3 bg-background/50 rounded-md">
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="
                    pythonStatus?.isInstalled && pythonStatus?.isValidVersion
                      ? 'bg-green-500'
                      : pythonStatus?.isInstalled
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  "
                ></div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-medium">Python 3.11+</span>
                  <span class="text-xs text-muted-foreground truncate">
                    {{ pythonStatus?.isInstalled ? `v${pythonStatus.version}` : 'Not installed' }}
                  </span>
                </div>
              </div>

              <!-- Tesseract Status -->
              <div class="flex items-center gap-2 p-3 bg-background/50 rounded-md">
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="
                    tesseractStatus?.isInstalled && !tesseractStatus?.error
                      ? 'bg-green-500'
                      : tesseractStatus?.isInstalled
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  "
                ></div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-medium">Tesseract</span>
                  <span class="text-xs text-muted-foreground truncate">
                    {{
                      tesseractStatus?.isInstalled ? `v${tesseractStatus.version}` : 'Not installed'
                    }}
                  </span>
                </div>
              </div>

              <!-- Ghostscript Status -->
              <div class="flex items-center gap-2 p-3 bg-background/50 rounded-md">
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="
                    ghostscriptStatus?.isInstalled && !ghostscriptStatus?.error
                      ? 'bg-green-500'
                      : ghostscriptStatus?.isInstalled
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  "
                ></div>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-medium">Ghostscript</span>
                  <span class="text-xs text-muted-foreground truncate">
                    {{
                      ghostscriptStatus?.isInstalled
                        ? `v${ghostscriptStatus.version}`
                        : 'Not installed'
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Warning messages for PATH issues -->
            <div
              v-if="
                !systemCheckLoading &&
                (pythonStatus?.error?.includes('PATH') ||
                  tesseractStatus?.error?.includes('PATH') ||
                  ghostscriptStatus?.error?.includes('PATH'))
              "
              class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md"
            >
              <p class="text-sm text-yellow-600 dark:text-yellow-500 font-medium mb-1">
                ⚠️ Configuration Warnings
              </p>
              <div
                v-if="pythonStatus?.error?.includes('PATH')"
                class="text-xs text-yellow-600 dark:text-yellow-400 mt-1"
              >
                • Python: {{ pythonStatus.error }}
              </div>
              <div
                v-if="tesseractStatus?.error?.includes('PATH')"
                class="text-xs text-yellow-600 dark:text-yellow-400 mt-1"
              >
                • Tesseract: {{ tesseractStatus.error }} (this is not critical)
              </div>
              <div
                v-if="ghostscriptStatus?.error?.includes('PATH')"
                class="text-xs text-yellow-600 dark:text-yellow-400 mt-1"
              >
                • Ghostscript: {{ ghostscriptStatus.error }}
              </div>
            </div>

            <!-- Error messages for missing dependencies -->
            <div
              v-if="
                !systemCheckLoading &&
                (!pythonStatus?.isInstalled ||
                  !tesseractStatus?.isInstalled ||
                  !ghostscriptStatus?.isInstalled)
              "
              class="p-3 bg-red-500/10 border border-red-500/20 rounded-md space-y-2"
            >
              <p class="text-sm text-red-500 font-medium">❌ Missing Dependencies</p>
              <p class="text-xs text-red-400">Please install the following before continuing:</p>

              <div
                v-if="!pythonStatus?.isInstalled"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-red-400">• Python 3.11+ (64-bit)</span>
                <a
                  href="https://www.python.org/downloads/"
                  target="_blank"
                  class="text-blue-500 hover:text-blue-400 cursor-pointer after:content-['_↗']"
                >
                  Download
                </a>
              </div>

              <div
                v-if="!tesseractStatus?.isInstalled"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-red-400">• Tesseract OCR</span>
                <a
                  href="https://github.com/UB-Mannheim/tesseract/wiki"
                  target="_blank"
                  class="text-blue-500 hover:text-blue-400 cursor-pointer after:content-['_↗']"
                >
                  Download
                </a>
              </div>

              <div
                v-if="!ghostscriptStatus?.isInstalled"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-red-400">• Ghostscript</span>
                <a
                  href="https://www.ghostscript.com/releases/gsdnld.html"
                  target="_blank"
                  class="text-blue-500 hover:text-blue-400 cursor-pointer after:content-['_↗']"
                >
                  Download
                </a>
              </div>
            </div>
          </div>

          <!-- Python Environment Setup -->
          <div v-if="allDependenciesMet() && !venvSetupComplete" class="space-y-3">
            <p class="text-sm font-semibold">Python Environment Setup Required</p>
            <p class="text-sm text-muted-foreground">
              Before you can use Panopticon, we need to set up a Python virtual environment and
              install the required OCR tools.
            </p>

            <button
              :disabled="venvSetupLoading"
              class="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="setupVenv"
            >
              {{ venvSetupLoading ? 'Setting up environment...' : 'Setup Python Environment' }}
            </button>

            <!-- Setup Progress Logs -->
            <div
              v-if="venvSetupLogs.length > 0"
              class="bg-background border border-accent rounded-md p-3 max-h-40 overflow-y-auto"
            >
              <div
                v-for="(log, index) in venvSetupLogs"
                :key="index"
                class="text-xs font-mono text-muted-foreground"
              >
                {{ log }}
              </div>
            </div>

            <!-- Setup Error -->
            <div
              v-if="venvSetupError"
              class="p-3 bg-red-500/10 border border-red-500/20 rounded-md"
            >
              <p class="text-sm text-red-500 font-medium">Setup Failed</p>
              <p class="text-xs text-red-400 mt-1">{{ venvSetupError }}</p>
            </div>
          </div>

          <!-- Setup Complete Message -->
          <div
            v-if="venvSetupComplete"
            class="p-3 bg-green-500/10 border border-green-500/20 rounded-md"
          >
            <p class="text-sm text-green-600 dark:text-green-500 font-medium">
              ✓ Python environment ready
            </p>
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
            :disabled="
              !allDependenciesMet() || !venvSetupComplete || systemCheckLoading || venvSetupLoading
            "
            class="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            @click="createDefaultSettings()"
          >
            {{
              systemCheckLoading
                ? 'Checking...'
                : !allDependenciesMet()
                  ? 'Install Dependencies First'
                  : !venvSetupComplete
                    ? 'Setup Python Environment First'
                    : "Let's Go!"
              }}
            </button>
          </div>
        </div>
      </div>
      </div>  
    </ScrollArea>
  </div>
</template>