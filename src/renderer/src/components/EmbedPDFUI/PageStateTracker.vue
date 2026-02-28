<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import { usePdfViewer } from '@/composables/usePdfViewer'

interface Props {
  viewSource?: string
}

const props = defineProps<Props>()

// Only set up tracking if we have a viewSource
if (props.viewSource) {
  const pdfViewer = usePdfViewer(props.viewSource)
  const { state } = useScroll()

  // Watch state.currentPage directly to track any page change
  const stopWatch = watch(
    () => state.value?.currentPage,
    (currentPage) => {
      // Don't update if page is 1 (initial load state) or invalid
      if (currentPage && currentPage > 1) {
        pdfViewer.updateLastKnownPage(currentPage)
      }
    }
  )

  // Stop watching when component unmounts (when routing away)
  onUnmounted(() => {
    stopWatch()
  })
}
</script>

<template>
  <div></div>
</template>
