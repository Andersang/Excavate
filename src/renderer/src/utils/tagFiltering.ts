/**
 * Shared tag filtering utilities to avoid duplication across components.
 */

/**
 * Filters items to only include those that have ALL of the selected tags.
 *
 * @param items - Array of items to filter
 * @param selectedTags - Array of tag names that must all be present
 * @param getItemTags - Function to extract tags from an item
 * @returns Filtered array of items
 */
export function filterByTags<T>(
  items: T[],
  selectedTags: string[],
  getItemTags: (item: T) => string[] | undefined
): T[] {
  if (selectedTags.length === 0) {
    return items
  }

  return items.filter((item) => {
    const itemTags = getItemTags(item) || []
    return selectedTags.every((tag) => itemTags.includes(tag))
  })
}

/**
 * Toggles a tag in the selected tags array.
 * If the tag is already selected, removes it. Otherwise, adds it.
 *
 * @param selectedTags - Current array of selected tags
 * @param tag - Tag to toggle
 * @returns New array with the tag toggled
 */
export function toggleTag(selectedTags: string[], tag: string): string[] {
  if (selectedTags.includes(tag)) {
    return selectedTags.filter((t) => t !== tag)
  }
  return [...selectedTags, tag]
}

/**
 * Checks if a tag is currently selected.
 *
 * @param selectedTags - Array of selected tags
 * @param tag - Tag to check
 * @returns True if the tag is selected
 */
export function isTagSelected(selectedTags: string[], tag: string): boolean {
  return selectedTags.includes(tag)
}
