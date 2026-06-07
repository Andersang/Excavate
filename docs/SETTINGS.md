# Settings Service

The settings service manages user settings and directory configurations for Excavate.

## Overview

- Settings are stored in `%USERPROFILE%\Documents\Excavate\settings.json`
- Settings are automatically loaded on app startup
- If no settings file exists, the app starts with an empty configuration
- All settings operations are persisted to disk automatically

## Settings Structure

```json
{
  "directories": {
    "uuid-1": {
      "path": "C:\\Users\\Username\\Documents\\Test PDFs",
      "name": "Test PDFs",
      "addedAt": "2025-09-14T09:34:37.042Z",
      "exists": true,
      "settings": {
        "watchForChanges": true,
        "excludePatterns": ["node_modules", ".git", ".DS_Store"]
      },
      "lastAccessed": "2025-10-25T13:20:38.667Z"
    }
  }
}
```

## Frontend API Usage

The settings API is available via `window.api.settings`:

### Check if settings file exists

```typescript
const exists = await window.api.settings.settingsFileExists()
// Returns: boolean
```

### Get all settings

```typescript
const settings = await window.api.settings.getAll()
// Returns: { directories: Record<string, Directory> }
```

### Get all directories

```typescript
const directories = await window.api.settings.getDirectories()
// Returns: Record<string, Directory>
```

### Get a specific directory

```typescript
const directory = await window.api.settings.getDirectory(id)
// Returns: Directory | null
```

### Add or update a directory

```typescript
const id = crypto.randomUUID()
const directory = {
  path: 'C:\\Users\\Example\\Documents\\Test',
  name: 'Test Directory',
  addedAt: new Date().toISOString(),
  exists: true,
  settings: {
    watchForChanges: true,
    excludePatterns: ['node_modules', '.git', '.DS_Store']
  },
  lastAccessed: new Date().toISOString()
}

await window.api.settings.addDirectory(id, directory)
```

### Remove a directory

```typescript
await window.api.settings.removeDirectory(id)
```

### Update directory settings

```typescript
await window.api.settings.updateDirectorySettings(id, {
  watchForChanges: false,
  excludePatterns: ['*.tmp']
})
```

### Update directory last accessed time

```typescript
await window.api.settings.updateDirectoryLastAccessed(id)
```

### Update directory exists status

```typescript
await window.api.settings.updateDirectoryExists(id, false)
```

### Reset all settings

```typescript
await window.api.settings.reset()
```

## Example Component

See `src/renderer/src/components/SettingsExample.vue` for a complete example of using the settings API.

## Backend Service

The settings service is implemented in `src/main/services/settingsService.ts` following the singleton pattern. It:

1. Initializes during app startup (`initApp()` in `src/main/index.ts`)
2. Loads existing settings from disk if available
3. Provides methods for CRUD operations on settings
4. Automatically persists changes to disk
5. Creates the Excavate directory in Documents if it doesn't exist

## Type Definitions

All TypeScript types are defined in `src/preload/index.d.ts`:

- `DirectorySettings` - Settings for a directory
- `Directory` - Complete directory configuration
- `AppSettings` - Root settings object
