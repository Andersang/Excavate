<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useSearch } from '@embedpdf/plugin-search/vue'
import { useScrollCapability } from '@embedpdf/plugin-scroll/vue'
import { MatchFlag } from '@embedpdf/models'
import type { SearchResult } from '@embedpdf/models'
import { Search as SearchIcon, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-vue-next'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'

const { state, provides } = useSearch()
const { provides: scroll } = useScrollCapability()

const inputValue = ref(state.value.query || '')
const inputRef = ref<HTMLInputElement>()

// Focus input when component mounts
onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
  inputValue.value = state.value.query || ''
})

// Watch for input changes and trigger search
watch(inputValue, (newValue) => {
  if (newValue === '') {
    provides.value?.stopSearch()
  } else {
    provides.value?.searchAllPages(newValue)
  }
})

// Auto-scroll to active result when it changes
watch(
  () => [state.value.activeResultIndex, state.value.loading, state.value.query, state.value.flags],
  ([activeIndex]) => {
    if (typeof activeIndex === 'number' && !state.value.loading) {
      scrollToItem(activeIndex)
    }
  }
)

const handleFlagChange = (flag: MatchFlag, checked: boolean) => {
  const currentFlags = state.value.flags
  if (checked) {
    provides.value?.setFlags([...currentFlags, flag])
  } else {
    provides.value?.setFlags(currentFlags.filter((f) => f !== flag))
  }
}

const clearInput = () => {
  inputValue.value = ''
  inputRef.value?.focus()
}

const scrollToItem = (index: number) => {
  const item = state.value.results[index]
  if (!item) return

  const minCoordinates = item.rects.reduce(
    (min, rect) => ({
      x: Math.min(min.x, rect.origin.x),
      y: Math.min(min.y, rect.origin.y)
    }),
    { x: Infinity, y: Infinity }
  )

  scroll.value?.scrollToPage({
    pageNumber: item.pageIndex + 1,
    pageCoordinates: minCoordinates,
    center: true
  })
}

const groupByPage = (results: SearchResult[]) => {
  return results.reduce<Record<number, { hit: SearchResult; index: number }[]>>((map, r, i) => {
    ;(map[r.pageIndex] ??= []).push({ hit: r, index: i })
    return map
  }, {})
}

const grouped = computed(() => groupByPage(state.value.results))

const handleHitClick = (index: number) => {
  provides.value?.goToResult(index)
}

const isMatchCaseChecked = computed(() => state.value.flags.includes(MatchFlag.MatchCase))

const isWholeWordChecked = computed(() => state.value.flags.includes(MatchFlag.MatchWholeWord))
</script>

<template>
  <div class="h-full flex flex-col bg-zinc-900">
    <!-- Search Input -->
    <div class="p-3">
      <div class="relative">
        <SearchIcon
          class="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400"
          :size="18"
        />
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          placeholder="Search"
          class="w-full pl-10 pr-10 py-2 bg-zinc-800 text-white border border-zinc-700 rounded focus:outline-none focus:border-blue-500"
        />
        <button
          v-if="inputValue"
          class="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
          @click="clearInput"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Search Options -->
      <div class="mt-3 space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="isMatchCaseChecked"
            class="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            @change="
              (e) => handleFlagChange(MatchFlag.MatchCase, (e.target as HTMLInputElement).checked)
            "
          />
          <span class="text-sm text-zinc-300">Case sensitive</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            :checked="isWholeWordChecked"
            class="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
            @change="
              (e) =>
                handleFlagChange(MatchFlag.MatchWholeWord, (e.target as HTMLInputElement).checked)
            "
          />
          <span class="text-sm text-zinc-300">Whole word</span>
        </label>
      </div>

      <div class="my-3 border-t border-zinc-700"></div>

      <!-- Results Summary -->
      <div v-if="state.active && !state.loading" class="flex items-center justify-between">
        <span class="text-sm text-blue-400">
          {{ state.total }} result{{ state.total !== 1 ? 's' : '' }} found
        </span>
        <div v-if="state.total > 1" class="flex gap-1">
          <button
            class="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
            title="Previous result"
            @click="provides?.previousResult()"
          >
            <ChevronUp :size="18" />
          </button>
          <button
            class="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
            title="Next result"
            @click="provides?.nextResult()"
          >
            <ChevronDown :size="18" />
          </button>
        </div>
      </div>
    </div>

    <!-- Results List -->
    <div class="flex-1 overflow-hidden">
      <ScrollArea class="h-full px-3 pb-3">
        <div v-if="state.loading" class="flex items-center justify-center py-8">
          <Loader2 :size="24" class="animate-spin text-blue-500" />
        </div>
        <div v-else class="space-y-4">
          <div v-for="[page, hits] in Object.entries(grouped)" :key="page">
            <div class="text-xs text-zinc-500 font-semibold mb-2">Page {{ Number(page) + 1 }}</div>

            <div class="space-y-2">
              <div
                v-for="{ hit, index } in hits"
                :key="index"
                :class="[
                  'p-3 rounded cursor-pointer transition-all',
                  index === state.activeResultIndex
                    ? 'bg-blue-500/20 border border-blue-500'
                    : 'bg-zinc-800 border border-zinc-700 hover:bg-zinc-750'
                ]"
                @click="handleHitClick(index)"
              >
                <div class="text-sm text-zinc-300">
                  <span v-if="hit.context.truncatedLeft">… </span>
                  <span>{{ hit.context.before }}</span>
                  <span class="font-bold text-blue-400">{{ hit.context.match }}</span>
                  <span>{{ hit.context.after }}</span>
                  <span v-if="hit.context.truncatedRight"> …</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

<style scoped>
/* No custom styles needed with Tailwind */
</style>
