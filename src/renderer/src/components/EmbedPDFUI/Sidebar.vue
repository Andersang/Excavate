<script setup lang="ts">
import { computed, ref } from 'vue'
import { ThumbnailsPane, ThumbImg } from '@embedpdf/plugin-thumbnail/vue'
import { useScroll } from '@embedpdf/plugin-scroll/vue'
import ScrollArea from '@/components/ui/scroll-area/ScrollArea.vue'

const { provides: scroll, state } = useScroll()
const isUserScrolling = ref(false)

const getIsActive = (pageIndex: number) => computed(() => state.value.currentPage === pageIndex + 1)

const handleClick = (pageIndex: number) => {
  isUserScrolling.value = true
  scroll.value?.scrollToPage({
    pageNumber: pageIndex + 1, // 1-based
    behavior: 'smooth'
  })
  // Reset flag after scroll animation completes
  setTimeout(() => {
    isUserScrolling.value = false
  }, 500)
}
</script>

<template>
  <div class="sidebar">
    <ScrollArea class="h-full">
      <ThumbnailsPane :style="{ width: '100%', height: '100%' }" class="thumbs-viewport">
        <template #default="{ meta }">
          <!-- absolute-positioned row inside the virtualized pane -->
          <div
            class="thumb-row"
            :class="{ active: getIsActive(meta.pageIndex).value }"
            :style="{
              position: 'absolute',
              top: meta.top + 'px',
              left: 0,
              right: 0,
              height: meta.wrapperHeight + 'px'
            }"
            @click="handleClick(meta.pageIndex)"
          >
            <div
              class="thumb-img-wrapper"
              :style="{
                /* outer box still uses the plugin width (meta.width + padding*2) */
                padding: (meta.padding || 0) + 'px',
                boxSizing: 'content-box' // ensures we keep the intended outer width
              }"
            >
              <ThumbImg
                class="thumb-img"
                :meta="meta"
                :style="{
                  width: meta.width + 'px',
                  height: meta.height + 'px',
                  display: 'block'
                }"
              />
            </div>
            <div class="thumb-label" :style="{ height: meta.labelHeight + 'px' }">
              Page {{ meta.pageIndex + 1 }}
            </div>
          </div>
        </template>
      </ThumbnailsPane>
    </ScrollArea>
  </div>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #27272a; /* zinc-800 */
}

.thumbs-viewport {
  position: relative;
}

.thumb-row {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
}

.thumb-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.thumb-row.active {
  background: rgba(59, 130, 246, 0.15); /* blue-500 with opacity */
  border-left-color: #3b82f6; /* blue-500 */
}

.thumb-img-wrapper {
  border-radius: 2px;
  background: #18181b; /* zinc-900 */
}

.thumb-img {
  border: 1px solid #52525b; /* zinc-600 */
  border-radius: 2px;
}

.thumb-row.active .thumb-img {
  border-color: #3b82f6; /* blue-500 */
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.thumb-label {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #a1a1aa; /* zinc-400 */
  font-weight: 500;
}

.thumb-row.active .thumb-label {
  color: #3b82f6; /* blue-500 */
}

.thumb-img {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08) inset,
    0 1px 2px rgba(0, 0, 0, 0.12);
}

/* Label under each image */
.thumb-label {
  font-size: 12px;
  line-height: 16px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
