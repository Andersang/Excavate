<script setup lang="ts">
import { ref, onMounted } from 'vue'

const appVersion = ref('')

onMounted(async () => {
  appVersion.value = await window.api.getAppVersion()
})
</script>

<template>
  <div
    id="Titlebar"
    class="flex fixed z-50 font-serif items-center w-full px-4 border-b border-accent h-[32px] bg-[--color-background]/50 backdrop-blur-2xl"
    style="-webkit-app-region: drag"
  >
    <span class="text-sm leading-none">
      Excavate<span v-if="appVersion" class="text-muted-foreground"> v{{ appVersion }}</span>
    </span>
    <!-- Reserve space for Windows controls (approx 138px) -->
    <div class="w-[138px]"></div>
  </div>
</template>
