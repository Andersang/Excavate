<script setup lang="ts">
import { useZoom, ZoomMode } from '@embedpdf/plugin-zoom/vue'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-vue-next'

const { provides: zoomProvider } = useZoom()

const zoomIn = (): void => {
  zoomProvider.value?.zoomIn()
}

const zoomOut = (): void => {
  zoomProvider.value?.zoomOut()
}

const resetZoom = (): void => {
  zoomProvider.value?.requestZoom(ZoomMode.FitPage)
}
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      title="Zoom Out"
      class="p-2 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
      @click="zoomOut"
    >
      <ZoomOut :size="18" />
    </button>
    <button
      title="Fit to Page"
      class="p-2 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
      @click="resetZoom"
    >
      <Maximize2 :size="18" />
    </button>
    <button
      title="Zoom In"
      class="p-2 bg-muted hover:bg-muted/80 text-foreground rounded transition-colors"
      @click="zoomIn"
    >
      <ZoomIn :size="18" />
    </button>
  </div>
</template>
