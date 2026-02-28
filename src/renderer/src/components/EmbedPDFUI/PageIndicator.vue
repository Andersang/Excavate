<script setup lang="ts">
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import { ref, watch } from 'vue'

const { state, provides: scroll } = useScroll()
const inputValue = ref('')
const isEditing = ref(false)

// Update input when page changes (but only when not editing)
watch(
  () => state.value.currentPage,
  (newPage) => {
    if (!isEditing.value) {
      inputValue.value = newPage.toString()
    }
  },
  { immediate: true }
)

const handleFocus = (): void => {
  isEditing.value = true
  inputValue.value = state.value.currentPage.toString()
}

const handleBlur = (): void => {
  isEditing.value = false
  inputValue.value = state.value.currentPage.toString()
}

const handleSubmit = (): void => {
  const page = parseInt(inputValue.value)
  
  if (!isNaN(page) && page >= 1 && page <= state.value.totalPages && scroll.value) {
    scroll.value.scrollToPage({
      pageNumber: page,
      behavior: 'smooth'
    })
  }
  
  isEditing.value = false
}

const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
    ;(e.target as HTMLInputElement).blur()
  } else if (e.key === 'Escape') {
    isEditing.value = false
    inputValue.value = state.value.currentPage.toString()
    ;(e.target as HTMLInputElement).blur()
  }
}

const handleInput = (e: Event): void => {
  const target = e.target as HTMLInputElement
  // Only allow numeric input
  target.value = target.value.replace(/[^0-9]/g, '')
  inputValue.value = target.value
}
</script>

<template>
  <div class="flex items-center gap-2 text-sm px-3 py-1 bg-muted rounded">
    <input
      v-model="inputValue"
      type="text"
      inputmode="numeric"
      class="w-12 text-center bg-transparent text-foreground font-medium focus:outline-none focus:text-primary focus:bg-accent rounded px-1"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeyDown"
      @input="handleInput"
    />
    <span class="text-zinc-500">/</span>
    <span class="text-zinc-400">{{ state.totalPages }}</span>
  </div>
</template>
