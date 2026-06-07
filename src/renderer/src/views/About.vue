<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import readmeContent from 'virtual:readme'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { uiLogger } from '@/utils/logger'

const version = ref('')
const readme = ref('')
const contentRef = ref<HTMLElement | undefined>(undefined)
const updateInfo = ref<{ hasUpdate: boolean; latestVersion?: string; downloadUrl?: string } | undefined>(
  undefined
)
const checkingUpdate = ref(false)

// Configure marked renderer to add IDs to headers for anchor links
const renderer = new marked.Renderer()
renderer.heading = ({ tokens, depth }) => {
  const text = tokens.map((t) => t.raw).join('')
  const id = text.toLowerCase().replace(/[^\w]+/g, '-')
  return `<h${depth} id="${id}">${text}</h${depth}>`
}

marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false, // Don't convert \n to <br>
  renderer
})

onMounted(async () => {
  // Get version from app via IPC
  version.value = await window.api.getAppVersion()

  // Parse markdown content to HTML, then sanitize before binding to v-html
  readme.value = DOMPurify.sanitize(await marked.parse(readmeContent))

  // Set up link click handlers after DOM updates
  await nextTick()
  setupLinkHandlers()

  // Check for updates automatically (respects 24-hour cache)
  checkForUpdates()
})

const checkForUpdates = async (force = false): Promise<void> => {
  try {
    checkingUpdate.value = true
    const result = force ? await window.api.update.checkNow() : await window.api.update.check()

    if (result && result.hasUpdate) {
      updateInfo.value = {
        hasUpdate: true,
        latestVersion: result.latestVersion,
        downloadUrl: result.downloadUrl
      }
      uiLogger.info(`Update available: ${result.currentVersion} → ${result.latestVersion}`, result)
    } else if (force) {
      // Only show "up to date" message when manually checking
      updateInfo.value = { hasUpdate: false }
      uiLogger.info('Application is up to date')
    }
  } catch (error) {
    uiLogger.error('Failed to check for updates', error)
  } finally {
    checkingUpdate.value = false
  }
}

const setupLinkHandlers = (): void => {
  if (!contentRef.value) return

  const links = contentRef.value.querySelectorAll('a')
  links.forEach((link) => {
    link.addEventListener('click', handleLinkClick)
  })
}

const handleLinkClick = (event: Event): void => {
  event.preventDefault()
  const link = event.target as HTMLAnchorElement
  const href = link.getAttribute('href')

  if (!href) return

  // Internal link (anchor)
  if (href.startsWith('#')) {
    const targetId = href.substring(1)
    const targetElement = document.getElementById(targetId)
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  // External link
  else {
    window.api.shell.openExternal(href)
  }
}

const openDownloadPage = (): void => {
  if (updateInfo.value?.downloadUrl) {
    window.api.shell.openExternal(updateInfo.value.downloadUrl)
  }
}
</script>

<template>
  <ScrollArea class="h-full">
    <div class="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 class="text-3xl font-headers mb-2">About Excavate</h1>
        <p class="text-muted-foreground">Version {{ version }}</p>
      </div>

      <!-- Update Check Section -->
      <div class="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div class="flex-1">
          <div v-if="updateInfo?.hasUpdate" class="space-y-2">
            <p class="font-semibold text-green-600 dark:text-green-400">
              🎉 Update Available: v{{ updateInfo.latestVersion }}
            </p>
            <Button v-if="updateInfo.downloadUrl" size="sm" @click="openDownloadPage">
              Download Update
            </Button>
          </div>
          <div v-else-if="updateInfo && !updateInfo.hasUpdate">
            <p class="text-muted-foreground">✓ You're using the latest version</p>
          </div>
          <div v-else>
            <p class="text-muted-foreground">Check for updates</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="checkingUpdate"
          @click="checkForUpdates(true)"
        >
          {{ checkingUpdate ? 'Checking...' : 'Check Now' }}
        </Button>
      </div>

      <!-- Content -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div ref="contentRef" class="markdown-content" v-html="readme" />
    </div>
  </ScrollArea>
</template>
