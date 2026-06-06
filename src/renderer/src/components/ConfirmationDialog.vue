<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  loading?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmVariant: 'default',
  loading: false
})

const emit = defineEmits<Emits>()

const handleConfirm = (): void => {
  if (!props.loading) {
    emit('confirm')
  }
}

const handleCancel = (): void => {
  if (!props.loading) {
    emit('cancel')
    emit('update:open', false)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button :disabled="loading" variant="outline" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button :disabled="loading" :variant="confirmVariant" @click="handleConfirm">
          {{ loading ? 'Processing...' : confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
