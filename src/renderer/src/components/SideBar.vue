<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Component } from 'vue'
import type { RouteMetadata } from '@/router'

interface SavedSearch {
  id: string
  name: string
  query: string
  tags: string[]
  createdAt: string
  lastUsed?: string
}

interface SearchHistoryEntry {
  id: string
  searchText: string
  query: string
  tags: string[]
  timestamp: string
  resultCount?: number
}

defineProps<{
  savedSearches?: SavedSearch[]
  searchHistory?: SearchHistoryEntry[]
}>()

const emit = defineEmits<{
  'execute-search': [searchText: string]
  'delete-saved': [id: string]
}>()

const router = useRouter()
const isCollapsed = ref(false)

const navigationRoutes = computed(() => {
  return router.options.routes.map((route) => ({
    path: route.path,
    name: route.name as string,
    icon: (route.meta as RouteMetadata)?.icon as Component | undefined,
    label: (route.meta as RouteMetadata)?.label || route.name
  }))
})

const sidebarWidth = computed(() => (isCollapsed.value ? '64px' : '270px'))

const toggleCollapse = (): void => {
  isCollapsed.value = !isCollapsed.value
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
</script>

<template>
  <!-- Sidebar -->
  <div
    id="SideBar"
    :style="{ width: sidebarWidth }"
    class="flex flex-col h-full overflow-hidden border-r border-accent bg-[--color-background]/50 backdrop-blur-2xl transition-all duration-300 shrink-0"
  >
    <!-- Sidebar Content -->
    <div class="flex flex-col h-full overflow-hidden px-1 py-3">
      <!-- Collapse Toggle Button -->
      <div class="flex justify-end px-2 mb-2 shrink-0">
        <button
          class="p-2 hover:bg-accent rounded-md transition-colors border border-accent/50 hover:border-accent"
          :title="isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          @click="toggleCollapse"
        >
          <svg
            v-if="isCollapsed"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      <!-- Sidebar Navigation -->
      <div class="flex flex-col py-2 mb-6 border-b border-accent">
        <ul>
          <li v-for="route in navigationRoutes" :key="route.path">
            <TooltipProvider v-if="isCollapsed">
              <Tooltip>
                <TooltipTrigger as-child>
                  <router-link
                    :to="route.path"
                    class="flex items-center justify-center px-3 py-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                    active-class="bg-accent font-medium text-foreground"
                  >
                    <component :is="route.icon" :size="20" />
                  </router-link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{{ route.label }}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <router-link
              v-else
              :to="route.path"
              class="flex items-center gap-3 px-3 py-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
              active-class="bg-accent font-medium text-foreground"
            >
              <component :is="route.icon" :size="20" />
              <span>{{ route.label }}</span>
            </router-link>
          </li>
        </ul>
      </div>
      <!-- End Sidebar Navigation -->

      <!-- Sidebar History (hidden when collapsed) -->
      <template v-if="!isCollapsed">
        <div class="flex flex-col py-2 px-3 mb-1">
          <span class="font-medium">History</span>
        </div>
        <ScrollArea class="flex-1 min-h-0 mb-2">
          <div v-if="savedSearches && savedSearches.length > 0" class="w-full pr-4">
            <span class="sticky top-0 z-10 block text-sm px-3 py-2 bg-background">Saved</span>
            <ul>
              <li
                v-for="search in savedSearches"
                :key="search.id"
                class="group flex items-center py-1 px-3 hover:bg-accent cursor-pointer rounded-md relative overflow-hidden"
                @click="emit('execute-search', search.name)"
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <a class="flex-1 truncate pr-8">{{ search.name }}</a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ search.name }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div
                  class="absolute right-0 inset-y-0 flex items-center bg-linear-to-l from-background via-background to-transparent pl-8 pr-2"
                >
                  <div
                    class="px-2 group-hover:visible invisible rounded-md hover:bg-accent"
                    @click.stop="emit('delete-saved', search.id)"
                  >
                    ×
                  </div>
                </div>
              </li>
            </ul>
          </div>
          <div v-if="searchHistory && searchHistory.length > 0" class="w-full pr-4">
            <span class="sticky top-0 z-10 block text-sm px-3 py-2 bg-background">Recents</span>
            <ul>
              <li
                v-for="entry in searchHistory"
                :key="entry.id"
                class="group flex items-center py-1 px-3 hover:bg-accent cursor-pointer rounded-md relative overflow-hidden"
                @click="emit('execute-search', entry.searchText)"
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <a class="flex-1 truncate pr-8">{{ entry.searchText }}</a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ entry.searchText }} ({{ entry.resultCount }} results)</p>
                      <p class="text-xs text-muted-foreground">{{ formatTime(entry.timestamp) }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </li>
            </ul>
          </div>
        </ScrollArea>
      </template>
      <!-- End Sidebar History -->
    </div>
    <!-- End Sidebar Content -->
  </div>
  <!-- End Sidebar -->
</template>
