<script setup lang="ts">
import { useViewportCapability } from '@embedpdf/plugin-viewport/vue'
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import { ref, computed, watch, onUnmounted } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const { provides: viewport } = useViewportCapability()
const { provides: scroll, state } = useScroll()

const isVisible = ref(false)
const isHovering = ref(false)
const hideTimeoutRef = ref<number | null>(null)
const inputValue = ref<string>('1')

// Update input value when current page changes
watch(
  () => state.value.currentPage,
  (newPage) => {
    inputValue.value = newPage.toString()
  },
  { immediate: true }
)

const startHideTimer = (): void => {
  if (hideTimeoutRef.value) {
    clearTimeout(hideTimeoutRef.value)
  }
  hideTimeoutRef.value = window.setTimeout(() => {
    if (!isHovering.value) {
      isVisible.value = false
    }
  }, 4000)
}

// Watch for scroll activity
watch(
  viewport,
  (newViewport) => {
    if (!newViewport) return

    return newViewport.onScrollActivity((activity) => {
      if (activity) {
        isVisible.value = true
        startHideTimer()
      }
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  if (hideTimeoutRef.value) {
    clearTimeout(hideTimeoutRef.value)
  }
})

const handleMouseEnter = (): void => {
  isHovering.value = true
  isVisible.value = true
}

const handleMouseLeave = (): void => {
  isHovering.value = false
  startHideTimer()
}

const handlePageSubmit = (): void => {
  const page = parseInt(inputValue.value)

  if (!isNaN(page) && page >= 1 && page <= state.value.totalPages && scroll.value) {
    scroll.value.scrollToPage({
      pageNumber: page
    })
  }
}

const handlePreviousPage = (): void => {
  if (state.value.currentPage > 1 && scroll.value) {
    scroll.value.scrollToPage({
      pageNumber: state.value.currentPage - 1
    })
  }
}

const handleNextPage = (): void => {
  if (state.value.currentPage < state.value.totalPages && scroll.value) {
    scroll.value.scrollToPage({
      pageNumber: state.value.currentPage + 1
    })
  }
}

const handleInputChange = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const numericValue = target.value.replace(/[^0-9]/g, '')
  inputValue.value = numericValue
}

const isPreviousDisabled = computed(() => state.value.currentPage === 1)
const isNextDisabled = computed(() => state.value.currentPage === state.value.totalPages)
</script>

<template>
  <div
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] transition-opacity duration-200"
    :class="isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
  >
    <div
      class="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg"
    >
      <!-- Previous page button -->
      <button
        @click="handlePreviousPage"
        :disabled="isPreviousDisabled"
        class="p-1.5 rounded transition-colors"
        :class="
          isPreviousDisabled
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-white hover:bg-zinc-700'
        "
        title="Previous page"
      >
        <ChevronLeft :size="18" />
      </button>

      <!-- Page input form -->
      <form @submit.prevent="handlePageSubmit" class="flex items-center gap-2">
        <input
          v-model="inputValue"
          @input="handleInputChange"
          type="text"
          inputmode="numeric"
          class="w-12 px-2 py-1 text-center bg-zinc-900 text-white border border-zinc-600 rounded text-sm focus:outline-none focus:border-blue-500"
        />
        <span class="text-zinc-400 text-sm">/</span>
        <span class="text-zinc-300 text-sm min-w-[2ch]">{{ state.totalPages }}</span>
      </form>

      <!-- Next page button -->
      <button
        @click="handleNextPage"
        :disabled="isNextDisabled"
        class="p-1.5 rounded transition-colors"
        :class="
          isNextDisabled
            ? 'text-zinc-600 cursor-not-allowed'
            : 'text-white hover:bg-zinc-700'
        "
        title="Next page"
      >
        <ChevronRight :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Remove spinner from number input */
input[type='text']::-webkit-inner-spin-button,
input[type='text']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
