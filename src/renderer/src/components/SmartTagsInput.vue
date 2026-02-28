<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { AcceptableInputValue } from 'reka-ui'
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputItemText
} from '@/components/ui/tags-input'

interface Props {
  modelValue: string[]
  availableTags?: string[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  availableTags: () => [],
  placeholder: 'Add tag...'
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const inputValue = ref('')
const showSuggestions = ref(false)
const selectedSuggestionIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// Filter suggestions based on input
const suggestions = computed(() => {
  if (!inputValue.value.trim()) {
    return []
  }
  
  const query = inputValue.value.toLowerCase()
  const currentTags = props.modelValue.map(t => t.toLowerCase())
  
  return props.availableTags
    .filter(tag => 
      tag.toLowerCase().includes(query) && 
      !currentTags.includes(tag.toLowerCase())
    )
    .slice(0, 5) // Limit to 5 suggestions
})

// Show suggestions when there are matches
watch([inputValue, suggestions], () => {
  showSuggestions.value = suggestions.value.length > 0 && inputValue.value.trim().length > 0
  selectedSuggestionIndex.value = 0
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  inputValue.value = target.value
  inputRef.value = target
}

const clearInput = () => {
  inputValue.value = ''
  if (inputRef.value) {
    inputRef.value.value = ''
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!showSuggestions.value) return
  
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedSuggestionIndex.value = Math.min(
      selectedSuggestionIndex.value + 1,
      suggestions.value.length - 1
    )
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
  } else if (event.key === 'Enter' && suggestions.value.length > 0) {
    event.preventDefault()
    applySuggestion(suggestions.value[selectedSuggestionIndex.value])
  } else if (event.key === 'Escape') {
    showSuggestions.value = false
  }
}

const applySuggestion = async (tag: string) => {
  emit('update:modelValue', [...props.modelValue, tag])
  showSuggestions.value = false
  
  // Clear the input field
  await nextTick()
  clearInput()
}

const handleTagsUpdate = (newTags: AcceptableInputValue[]): void => {
  // TagsInput can accept numbers or strings, but we only emit strings
  const stringTags = newTags.map((tag) => String(tag))
  emit('update:modelValue', stringTags)
}
</script>

<template>
  <div class="relative">
    <TagsInput :model-value="modelValue" @update:model-value="handleTagsUpdate" class="w-full">
      <TagsInputItem v-for="tag in modelValue" :key="tag" :value="tag">
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput
        :placeholder="placeholder"
        @input="handleInput"
        @keydown="handleKeyDown"
      />
    </TagsInput>

    <!-- Suggestions Dropdown -->
    <div
      v-if="showSuggestions"
      class="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto"
    >
      <div
        v-for="(suggestion, index) in suggestions"
        :key="suggestion"
        :class="[
          'px-3 py-2 text-sm cursor-pointer transition-colors',
          index === selectedSuggestionIndex
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50'
        ]"
        @click="applySuggestion(suggestion)"
        @mouseenter="selectedSuggestionIndex = index"
      >
        {{ suggestion }}
      </div>
    </div>
  </div>
</template>
