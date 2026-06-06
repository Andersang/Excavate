<script setup lang="ts">
// Components
import TitleBar from '@/components/TitleBar.vue'
import SideBar from '@/components/SideBar.vue'
import InitPage from '@/views/InitPage.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { uiLogger } from '@/utils/logger'
import { emitExecuteSavedSearch } from '@/utils/appEvents'

const router = useRouter()
const settingsExists = ref(false)
const savedSearches = ref<Awaited<ReturnType<typeof window.api.search.getSaved>>>([])
const searchHistory = ref<Awaited<ReturnType<typeof window.api.search.getHistory>>>([])

const loadSearchData = async (): Promise<void> => {
  try {
    const [saved, history] = await Promise.all([
      window.api.search.getSaved(),
      window.api.search.getHistory()
    ])

    savedSearches.value = saved
    searchHistory.value = history
  } catch (error) {
    uiLogger.error('Failed to load search data:', error)
  }
}

const handleExecuteSearch = async (searchText: string): Promise<void> => {
  // Navigate to search page first
  await router.push('/')

  // Then emit event that Base.vue can listen to
  emitExecuteSavedSearch(searchText)
}

const handleDeleteSaved = async (id: string): Promise<void> => {
  try {
    await window.api.search.deleteSaved(id)
    await loadSearchData()
  } catch (error) {
    uiLogger.error('Failed to delete saved search:', error)
  }
}

const handleSettingsCreated = async (): Promise<void> => {
  settingsExists.value = true
  await loadSearchData()
}

onMounted(async () => {
  settingsExists.value = await window.api.settings.settingsFileExists()
  if (settingsExists.value) {
    await loadSearchData()
  }

  // Listen for refresh events from child components
  window.addEventListener('refresh-saved-searches', loadSearchData)
  window.addEventListener('settings-created', handleSettingsCreated)
})

onBeforeUnmount(() => {
  window.removeEventListener('refresh-saved-searches', loadSearchData)
  window.removeEventListener('settings-created', handleSettingsCreated)
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <TitleBar />
    <template v-if="settingsExists">
      <main class="flex flex-1 min-h-0 pt-[32px]">
        <SideBar
          :saved-searches="savedSearches"
          :search-history="searchHistory"
          @execute-search="handleExecuteSearch"
          @delete-saved="handleDeleteSaved"
        />

        <div id="routeView" class="flex-1 overflow-hidden">
          <router-view v-slot="{ Component }">
            <keep-alive v-if="Component">
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </div>
      </main>
    </template>
    <template v-else>
      <InitPage />
    </template>
  </div>
</template>
