<script setup lang="ts">
import { watch } from 'vue'
import { useScroll } from '@embedpdf/plugin-scroll/vue'

interface Props {
  targetPage?: number
}

const props = defineProps<Props>()
const { provides: scroll } = useScroll()

const scrollToPage = (page: number): void => {
  console.log('[ScrollToPage] Attempting to scroll to page:', page, 'Scroll available:', !!scroll.value)
  if (scroll.value) {
    scroll.value.scrollToPage({
      pageNumber: page,
      behavior: 'instant'
    })
  } else {
    console.log('[ScrollToPage] Scroll not available yet, waiting...')
    // If scroll not available, watch for it
    const unwatch = watch(
      scroll,
      (scrollCapability) => {
        if (scrollCapability) {
          console.log('[ScrollToPage] Scroll now available, scrolling to:', page)
          scrollCapability.scrollToPage({
            pageNumber: page,
            behavior: 'instant'
          })
          unwatch()
        }
      },
      { immediate: true }
    )
  }
}

// Watch for targetPage changes and scroll
watch(
  () => props.targetPage,
  (newPage, oldPage) => {
    console.log('[ScrollToPage] targetPage changed from', oldPage, 'to', newPage)
    if (newPage && newPage > 1) {
      setTimeout(() => {
        scrollToPage(newPage)
      }, 100)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div></div>
</template>
