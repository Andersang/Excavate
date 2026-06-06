import { ref } from 'vue'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  duration?: number
}

// Module-level state for notifications (singleton pattern)
const notifications = ref<Notification[]>([])

let notificationIdCounter = 0

/**
 * Composable for managing application-wide notifications.
 * Provides a consistent interface for displaying success, error, warning, and info messages.
 *
 * @remarks
 * Uses a singleton pattern with module-level refs so all components observe the same
 * notification state. Notifications auto-dismiss after a configurable duration.
 */
export function useNotification() {
  const showNotification = (
    type: NotificationType,
    message: string,
    duration: number = 5000
  ): void => {
    const id = `notification-${++notificationIdCounter}`
    const notification: Notification = { id, type, message, duration }

    notifications.value.push(notification)

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id)
      }, duration)
    }
  }

  const dismissNotification = (id: string): void => {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  const success = (message: string, duration?: number): void => {
    showNotification('success', message, duration)
  }

  const error = (message: string, duration?: number): void => {
    showNotification('error', message, duration)
  }

  const warning = (message: string, duration?: number): void => {
    showNotification('warning', message, duration)
  }

  const info = (message: string, duration?: number): void => {
    showNotification('info', message, duration)
  }

  const clearAll = (): void => {
    notifications.value = []
  }

  return {
    notifications,
    success,
    error,
    warning,
    info,
    dismissNotification,
    clearAll
  }
}
