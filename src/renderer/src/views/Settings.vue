<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { uiLogger } from '@/utils/logger'

interface SystemDependency {
  name: string
  version?: string
  isInstalled: boolean
  isValidVersion?: boolean
  requiredVersion?: string
  architecture?: string
  error?: string
}

const pythonStatus = ref<SystemDependency | null>(null)
const tesseractStatus = ref<SystemDependency | null>(null)
const ghostscriptStatus = ref<SystemDependency | null>(null)
const pypdf2Status = ref<SystemDependency | null>(null)

// Python venv status
const venvStatus = ref<any>(null)
const isSettingUpVenv = ref(false)
const setupProgress = ref('')
const setupLogs = ref<string[]>([])
const logScrollArea = ref<HTMLElement | null>(null)

onMounted(async () => {
  // Load all system dependencies
  pythonStatus.value = await window.api.getPythonStatus()
  tesseractStatus.value = await window.api.getTesseractStatus()
  ghostscriptStatus.value = await window.api.getGhostscriptStatus()
  pypdf2Status.value = await window.api.getPyPDF2Status()

  // Check Python venv status
  await checkVenvStatus()

  // Listen for setup progress events
  window.api.python.onSetupProgress((message: string) => {
    addLog(message)
  })

  uiLogger.debug('System status:', {
    python: pythonStatus.value,
    tesseract: tesseractStatus.value,
    ghostscript: ghostscriptStatus.value,
    venv: venvStatus.value
  })
})

const checkVenvStatus = async () => {
  try {
    venvStatus.value = await window.api.python.checkVenvStatus()
    uiLogger.debug('Venv status:', venvStatus.value)
  } catch (error) {
    uiLogger.error('Error checking venv status:', error)
  }
}

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString()
  setupLogs.value.push(`[${timestamp}] ${message}`)

  // Auto-scroll to bottom
  nextTick(() => {
    if (logScrollArea.value) {
      const scrollContainer = logScrollArea.value.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  })
}

const setupPythonEnvironment = async () => {
  if (!pythonStatus.value?.isInstalled) {
    alert('Python 3.11+ must be installed first!')
    return
  }

  isSettingUpVenv.value = true
  setupLogs.value = [] // Clear previous logs
  setupProgress.value = 'Setting up Python virtual environment...'

  try {
    // Run setup - progress will be sent via IPC events
    const result = await window.api.python.setupEnvironment()

    if (result.success) {
      setupProgress.value = 'Success! Environment ready.'
      await checkVenvStatus()

      setTimeout(() => {
        isSettingUpVenv.value = false
        setupProgress.value = ''
      }, 3000)
    } else {
      setupProgress.value = `Error: ${result.error}`

      setTimeout(() => {
        isSettingUpVenv.value = false
        setupProgress.value = ''
      }, 5000)
    }
  } catch (error) {
    uiLogger.error('Error setting up environment:', error)
    addLog(`✗ Exception: ${error}`)
    setupProgress.value = `Error: ${error}`

    setTimeout(() => {
      isSettingUpVenv.value = false
      setupProgress.value = ''
    }, 5000)
  }
}

const getStatusColor = (dep: SystemDependency | null) => {
  if (!dep || !dep.isInstalled) return 'text-destructive'
  if (dep.isValidVersion === false) return 'text-yellow-500'
  return 'text-green-500'
}

const getStatusIcon = (dep: SystemDependency | null) => {
  if (!dep || !dep.isInstalled) return '✗'
  if (dep.isValidVersion === false) return '⚠'
  return '✓'
}


</script>

<template>
  <div class="p-8 max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-3xl font-headers mb-2">Settings</h1>
      <p class="text-muted-foreground">System dependencies and configuration</p>
    </div>

    <!-- System Dependencies -->
    <section class="mb-2">
      <h2 class="text-xl mb-2 pb-2 border-b border-accent">System Dependencies</h2>
      <p class="text-sm text-muted-foreground mb-4">Required for offline document processing</p>

      <!-- Python Status -->
      <div
        v-if="pythonStatus"
        class="flex items-center justify-between pb-4 bg-background rounded-md"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ pythonStatus.name }}</span>
            <span :class="getStatusColor(pythonStatus)" class="text-xl">
              {{ getStatusIcon(pythonStatus) }}
            </span>
          </div>
          <div v-if="pythonStatus.isInstalled" class="text-sm text-muted-foreground mt-1">
            Version: {{ pythonStatus.version }} ({{ pythonStatus.architecture }})
            <span v-if="pythonStatus.requiredVersion" class="ml-2">
              • Required: {{ pythonStatus.requiredVersion }}
            </span>
          </div>
          <div v-else class="text-sm text-muted-foreground mt-1">Not installed</div>
          <div v-if="pythonStatus.error" class="text-sm text-yellow-500 mt-1">
            {{ pythonStatus.error }}
          </div>
        </div>
      </div>

      <!-- Python Virtual Environment Status -->
      <div v-if="pythonStatus?.isInstalled" class="pb-4 mb-4 border-b border-accent/30">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium">Python Virtual Environment</span>
              <span
                v-if="venvStatus"
                class="text-xl"
                :class="
                  venvStatus.exists && venvStatus.hasOcrmypdf ? 'text-green-500' : 'text-yellow-500'
                "
              >
                {{ venvStatus.exists && venvStatus.hasOcrmypdf ? '✓' : '⚠' }}
              </span>
            </div>

            <div v-if="venvStatus" class="text-sm text-muted-foreground mt-1">
              <div v-if="venvStatus.exists && venvStatus.hasOcrmypdf">
                ✓ Virtual environment ready • ocrmypdf {{ venvStatus.ocrmypdfVersion }}
                <span v-if="pypdf2Status?.isInstalled" class="ml-2">• PyPDF2 {{ pypdf2Status.version }}</span>
              </div>
              <div v-else-if="venvStatus.exists">
                ⚠ Virtual environment exists but ocrmypdf not installed
              </div>
              <div v-else>⚠ Virtual environment not set up</div>
            </div>

            <div
              v-if="setupProgress"
              class="text-sm mt-2"
              :class="
                setupProgress.includes('Success')
                  ? 'text-green-500'
                  : setupProgress.includes('Error')
                    ? 'text-destructive'
                    : 'text-primary'
              "
            >
              {{ setupProgress }}
            </div>
          </div>

          <Button
            v-if="!venvStatus?.exists || !venvStatus?.hasOcrmypdf"
            @click="setupPythonEnvironment"
            :disabled="isSettingUpVenv"
            size="sm"
          >
            {{ isSettingUpVenv ? 'Setting up...' : 'Setup Environment' }}
          </Button>
        </div>

        <!-- Setup Logs -->
        <div v-if="setupLogs.length > 0" class="mt-4">
          <div class="text-sm font-medium mb-2">Setup Log:</div>
          <ScrollArea
            ref="logScrollArea"
            class="h-48 w-full rounded-md border border-accent bg-background/50 p-3"
          >
            <div class="space-y-1 font-mono text-xs">
              <div v-for="(log, index) in setupLogs" :key="index" class="text-muted-foreground">
                {{ log }}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <!-- Tesseract Status -->
      <div
        v-if="tesseractStatus"
        class="flex items-center justify-between pb-4 bg-background rounded-md"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ tesseractStatus.name }}</span>
            <span :class="getStatusColor(tesseractStatus)" class="text-xl">
              {{ getStatusIcon(tesseractStatus) }}
            </span>
          </div>
          <div v-if="tesseractStatus.isInstalled" class="text-sm text-muted-foreground mt-1">
            Version: {{ tesseractStatus.version }}
            <span v-if="tesseractStatus.architecture"> ({{ tesseractStatus.architecture }})</span>
            <span v-if="tesseractStatus.requiredVersion" class="ml-2">
              • Required: {{ tesseractStatus.requiredVersion }}
            </span>
          </div>
          <div v-else class="text-sm text-muted-foreground mt-1">Not installed</div>
          <div v-if="tesseractStatus.error" class="text-sm text-yellow-500 mt-1">
            {{ tesseractStatus.error }}
          </div>
        </div>
      </div>

      <!-- Ghostscript Status -->
      <div
        v-if="ghostscriptStatus"
        class="flex items-center justify-between pb-4 bg-background rounded-md"
      >
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ ghostscriptStatus.name }}</span>
            <span :class="getStatusColor(ghostscriptStatus)" class="text-xl">
              {{ getStatusIcon(ghostscriptStatus) }}
            </span>
          </div>
          <div v-if="ghostscriptStatus.isInstalled" class="text-sm text-muted-foreground mt-1">
            Version: {{ ghostscriptStatus.version }}
            <span v-if="ghostscriptStatus.architecture">
              ({{ ghostscriptStatus.architecture }})</span
            >
            <span v-if="ghostscriptStatus.requiredVersion" class="ml-2">
              • Required: {{ ghostscriptStatus.requiredVersion }}
            </span>
          </div>
          <div v-else class="text-sm text-muted-foreground mt-1">Not installed</div>
          <div v-if="ghostscriptStatus.error" class="text-sm text-yellow-500 mt-1">
            {{ ghostscriptStatus.error }}
          </div>
        </div>
      </div>



      <!-- Loading State -->
      <div
        v-if="!pythonStatus && !tesseractStatus && !ghostscriptStatus"
        class="flex items-center justify-center p-4"
      >
        <span class="text-muted-foreground">Checking dependencies...</span>
      </div>
    </section>
  </div>
</template>
