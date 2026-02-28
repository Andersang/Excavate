<!-- Example component demonstrating settings usage -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const settingsExist = ref(false)
const directories = ref<Record<string, any>>({})

// Check if settings file exists on mount
onMounted(async () => {
  settingsExist.value = await window.api.settings.settingsFileExists()

  if (settingsExist.value) {
    // Load directories if settings exist
    directories.value = await window.api.settings.getDirectories()
    console.log('Loaded directories:', directories.value)
  } else {
    console.log('No settings file found - first run')
  }
})

// Example: Add a new directory
async function addExampleDirectory() {
  const id = crypto.randomUUID()
  const directory = {
    path: 'C:\\Users\\Example\\Documents\\Test',
    name: 'Test Directory',
    addedAt: new Date().toISOString(),
    exists: true,
    settings: {
      watchForChanges: true,
      excludePatterns: ['node_modules', '.git', '.DS_Store'],
      fileTypes: ['pdf', 'markdown', 'md']
    },
    lastAccessed: new Date().toISOString()
  }

  await window.api.settings.addDirectory(id, directory)

  // Reload directories
  directories.value = await window.api.settings.getDirectories()
  settingsExist.value = true
}

// Example: Update directory last accessed
async function updateLastAccessed(id: string) {
  await window.api.settings.updateDirectoryLastAccessed(id)
  directories.value = await window.api.settings.getDirectories()
}

// Example: Remove directory
async function removeDirectory(id: string) {
  await window.api.settings.removeDirectory(id)
  directories.value = await window.api.settings.getDirectories()
}
</script>

<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-4">Settings Example</h2>

    <div class="mb-4">
      <p class="mb-2">
        Settings file exists:
        <span :class="settingsExist ? 'text-green-500' : 'text-red-500'">
          {{ settingsExist ? 'Yes' : 'No' }}
        </span>
      </p>

      <button
        @click="addExampleDirectory"
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Example Directory
      </button>
    </div>

    <div v-if="Object.keys(directories).length > 0">
      <h3 class="text-lg font-semibold mb-2">Directories:</h3>

      <div v-for="(dir, id) in directories" :key="id" class="mb-3 p-3 border rounded">
        <div class="font-semibold">{{ dir.name }}</div>
        <div class="text-sm text-gray-600">{{ dir.path }}</div>
        <div class="text-xs text-gray-500 mt-1">
          Added: {{ new Date(dir.addedAt).toLocaleDateString() }}
        </div>
        <div class="text-xs text-gray-500">
          Last accessed: {{ new Date(dir.lastAccessed).toLocaleDateString() }}
        </div>
        <div class="mt-2 space-x-2">
          <button
            @click="updateLastAccessed(id as string)"
            class="px-2 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
          >
            Update Last Accessed
          </button>
          <button
            @click="removeDirectory(id as string)"
            class="px-2 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
    <div v-else class="text-gray-500">No directories added yet</div>
  </div>
</template>
