<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useSelectionCapability, type SelectionRangeX } from '@embedpdf/plugin-selection/vue'
import { Copy, Check } from 'lucide-vue-next'
import { viewLogger } from '@/utils/logger'

const { provides: selection } = useSelectionCapability()
const showCopied = ref(false)
const hasSelection = ref(false)

// Watch for when selection becomes available and set up the listener
watch(
  selection,
  (newSelection) => {
    viewLogger.debug('[CopyButton] Selection changed:', newSelection)
    if (newSelection) {
      viewLogger.debug('[CopyButton] Setting up onSelectionChange listener')
      newSelection.onSelectionChange((sel: SelectionRangeX | null) => {
        viewLogger.debug('[CopyButton] Selection change detected:', sel)
        hasSelection.value = !!sel
      })
    }
  },
  { immediate: true }
)

const copyToClipboard = async (): Promise<void> => {
  if (!selection.value) return

  try {
    await selection.value.copyToClipboard()
    showCopied.value = true
    setTimeout(() => {
      showCopied.value = false
    }, 2000)
  } catch (err) {
    viewLogger.error('Failed to copy text:', err)
  }
}

const handleKeyDown = (e: KeyboardEvent): void => {
  // Check for Ctrl+C (Windows/Linux) or Cmd+C (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'c' && hasSelection.value) {
    e.preventDefault()
    copyToClipboard()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <button
    v-if="hasSelection"
    class="p-2 rounded transition-colors"
    :class="
      showCopied
        ? 'bg-green-600 hover:bg-green-500 text-primary-foreground'
        : 'bg-primary hover:bg-primary/90 text-primary-foreground'
    "
    :title="showCopied ? 'Copied!' : 'Copy selection (Ctrl+C)'"
    @click="copyToClipboard"
  >
    <Check v-if="showCopied" :size="18" />
    <Copy v-else :size="18" />
  </button>
</template>
