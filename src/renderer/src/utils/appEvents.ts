// Typed emit helpers for cross-view window events.
// Augmenting WindowEventMap makes all addEventListener/removeEventListener
// calls for these event names fully typed throughout the renderer — no casts needed.

export function emitDirectoryAdded(directoryId: string): void {
  window.dispatchEvent(new CustomEvent('directory-added', { detail: { directoryId } }))
}

export function emitDirectoryUpdated(directoryId: string, fileCount: number): void {
  window.dispatchEvent(new CustomEvent('directory-updated', { detail: { directoryId, fileCount } }))
}

export function emitExecuteSavedSearch(query: string): void {
  window.dispatchEvent(new CustomEvent('execute-saved-search', { detail: query }))
}

export function emitBookmarkAdded(): void {
  window.dispatchEvent(new CustomEvent('bookmark-added'))
}

declare global {
  interface WindowEventMap {
    'directory-added': CustomEvent<{ directoryId: string }>
    'directory-updated': CustomEvent<{ directoryId: string; fileCount: number }>
    'execute-saved-search': CustomEvent<string>
    'bookmark-added': CustomEvent<void>
  }
}
