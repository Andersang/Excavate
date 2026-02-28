<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SmartTagsInput from '@/components/SmartTagsInput.vue'

const props = defineProps<{
  open: boolean
  fileName: string
  currentPage: number
  availableTags: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [bookmark: { name: string; tags: string[]; notes?: string }]
}>()

// Form state
const bookmarkName = ref('')
const bookmarkTags = ref<string[]>([])
const bookmarkNotes = ref('')

// Reset form when dialog opens
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      bookmarkName.value = `${props.fileName} - Page ${props.currentPage}`
      bookmarkTags.value = []
      bookmarkNotes.value = ''
    }
  }
)

const handleSave = (): void => {
  if (!bookmarkName.value.trim()) {
    return
  }

  emit('save', {
    name: bookmarkName.value.trim(),
    tags: bookmarkTags.value,
    notes: bookmarkNotes.value.trim() || undefined
  })

  emit('update:open', false)
}

const handleCancel = (): void => {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add Bookmark</DialogTitle>
        <DialogDescription>
          Save a bookmark to page {{ currentPage }} of {{ fileName }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Bookmark Name -->
        <div class="space-y-2">
          <label for="bookmark-name" class="text-sm font-medium"> Name </label>
          <Input
            id="bookmark-name"
            v-model="bookmarkName"
            placeholder="Enter bookmark name"
            @keydown.enter="handleSave"
          />
        </div>

        <!-- Tags -->
        <div class="space-y-2">
          <label class="text-sm font-medium"> Tags </label>
          <SmartTagsInput v-model="bookmarkTags" :available-tags="availableTags" />
        </div>

        <!-- Notes -->
        <div class="space-y-2">
          <label for="bookmark-notes" class="text-sm font-medium"> Notes (Optional) </label>
          <Textarea
            id="bookmark-notes"
            v-model="bookmarkNotes"
            placeholder="Add any notes about this bookmark..."
            rows="3"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel"> Cancel </Button>
        <Button :disabled="!bookmarkName.trim()" @click="handleSave"> Save Bookmark </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
