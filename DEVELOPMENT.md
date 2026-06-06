# Panopticon — Developer Guide

A practical reference for working on this codebase. Covers the architecture, data flows, IPC contract, and common patterns.

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 38 |
| Build tool | electron-vite 4 (Vite 6 under the hood) |
| Renderer framework | Vue 3 (Composition API + `<script setup lang="ts">`) |
| Language | TypeScript 5 / ES2022 modules throughout |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Component library | reka-ui (shadcn-style primitives) + lucide-vue-next icons |
| Routing | vue-router 4 (memory history — no browser URL) |
| Package manager | pnpm |

---

## Repository Layout

```
src/
  main/          ← Node.js / Electron main process
    index.ts       app entry point, window creation, startup sequence
    ipc/           IPC handler registration (one file per domain)
    services/      business logic; no Electron imports except where needed
    utils/         logger, pathValidation
  preload/
    index.ts       contextBridge — builds the window.api surface
    index.d.ts     ambient types so the renderer can see window.api
  shared/
    types.ts       domain interfaces shared by main + preload (FileInfo, Directory, Bookmark…)
  renderer/
    index.html
    src/
      main.ts        Vue app bootstrap
      App.vue        root component (wraps router-view)
      router/        route definitions
      views/         one .vue per route (Base, Library, Bookmarks, Settings, About, InitPage)
      components/    shared UI components
      composables/   (usePdfViewer.ts; planned: useDocumentSearch, useLibraryDirectory)
      assets/        main.css (Tailwind entry)
      lib/utils.ts   cn() helper (clsx + tailwind-merge)
src/
  resources/     native binaries (pdfium WASM)
  public/assets  static assets copied verbatim into the renderer bundle
  scripts/       build-time helpers (generate-ico.js)
  build/         macOS entitlements
```

---

## Process Architecture

Electron enforces a hard boundary between three contexts:

```
┌─────────────────────────────────────────────────────────────┐
│  Main process  (Node.js — full OS access)                   │
│    services/   — pure business logic classes                │
│    ipc/        — IPC handler registration                   │
│    utils/      — logger, path sandbox                       │
└──────────────┬──────────────────────────────────────────────┘
               │ ipcMain.handle / ipcRenderer.invoke
               │ contextBridge.exposeInMainWorld
┌──────────────┴──────────────────────────────────────────────┐
│  Preload script  (Node.js + limited renderer, isolated)     │
│    Bridges the gap: builds window.api from ipcRenderer      │
│    No DOM access; no direct service imports                 │
└──────────────┬──────────────────────────────────────────────┘
               │ window.api  (typed via preload/index.d.ts)
┌──────────────┴──────────────────────────────────────────────┐
│  Renderer process  (browser context — no Node.js)           │
│    Vue 3 SPA; calls window.api.xxx() for anything OS-side   │
└─────────────────────────────────────────────────────────────┘
```

**Key rules:**
- Renderer code must never import from `src/main/` or `src/shared/`.
- Main process code must never import renderer modules.
- `src/shared/types.ts` is the one exception — it is imported by `src/preload/index.ts`, and its public shapes are re-exported through `index.d.ts` ambient declarations for the renderer.

---

## Startup Sequence

```
app.whenReady()
  └─ initApp()
       1. pdfTempService.initialize()          create temp dir for PDF screenshots
       2. settingsService.init()               load (or create) settings.json
       3. registerIpcHandlers()                bind all ipcMain.handle() channels
       4. directoryWatcherService              start fs watchers for watched dirs
            .initializeWatchers()
  └─ createWindow()                           show BrowserWindow, load renderer
```

> **Order matters.** IPC handlers are registered _before_ watchers so the `directory:updated` push channel exists before any watcher fires.

---

## IPC Contract

All communication goes through `window.api`, defined in `src/preload/index.ts` and typed in `src/preload/index.d.ts`.

### Invoke/Handle (request–response)

Every `window.api.xxx()` call maps to an `ipcMain.handle('channel', ...)` registered in one of the files under `src/main/ipc/`:

| File | Channels (prefix) | What it owns |
|---|---|---|
| `handlers.ts` | `get-app-version`, `ping`, `dialog:open-directory`, `shell:open-external`, `file:*` | misc / shell |
| `directoryHandlers.ts` | `directory:*` | directory config, indexing, file-watching, tag updates |
| `pdfHandlers.ts` | `pdf:*` | page count, temp-file rendering |
| `bookmarkHandlers.ts` | `bookmark:*` | CRUD on `panopticon.directory.json` bookmark list |
| `documentProcessingHandlers.ts` | `document:*` | OCR orchestration |
| `searchHistoryHandlers.ts` | `search:*` | saved search persistence |
| `settingsHandlers.ts` | `settings:*` | app settings CRUD |
| `secureStorageHandlers.ts` | `secure-storage:*` | encrypted key-value store |
| `updateCheckHandlers.ts` | `update:*` | GitHub release check |

handler registration is all done in `src/main/ipc/handlers.ts` via `registerIpcHandlers()`, which calls each domain's register function.

### Push (main → renderer)

| Channel | Payload | When |
|---|---|---|
| `directory:updated` | `{ directoryId: string, fileCount: number }` | after a watcher-triggered auto-reindex |

Subscribe in the renderer via `window.api.directory.onDirectoryUpdated(cb)` and clean up with `offDirectoryUpdated(cb)` in `onUnmounted`.

---

## Path Security

Every IPC handler that accepts a file-system path calls `isPathAllowed()` (from `src/main/utils/pathValidation.ts`) before touching the disk. The function resolves the path and ensures it lives under one of:

- A directory path the user has added to their library (from `settingsService.getDirectories()`)
- The Electron `userData` directory
- `documents/Panopticon`

Handlers return `{ success: false, error: 'Access denied' }` (or a safe default like `1` for page count) when the check fails.

---

## Services

Services live in `src/main/services/` and are exported as singletons. They have no direct Electron imports except where necessary (e.g., `app.getPath()`).

| Service | Singleton export | Responsibility |
|---|---|---|
| `settingsService` | ✓ | Load/save `settings.json` in `documents/Panopticon/` |
| `directoryWatcherService` | ✓ | Wrap chokidar; debounce re-index triggers |
| `bookmarkService` | ✓ | Read/write bookmark arrays inside `panopticon.directory.json` |
| `searchHistoryService` | ✓ | Persist saved searches to `documents/Panopticon/saved-searches/` |
| `secureStorageService` | ✓ | AES-encrypted key-value JSON in `userData/secure-storage.dat` |
| `documentProcessingService` | ✓ | Thin orchestrator — delegates to `tesseractOcrService` |
| `tesseractOcrService` | ✓ | OCR via tesseract.js; per-file result cache keyed on `mtime + size` |
| `pdfTempService` | ✓ | Manages a temp directory for screenshot BMP files |
| `pdf-screenshot-service` | (class) | Off-screen Electron `BrowserWindow` → pdfium render → BMP |
| `updateCheckService` | ✓ | Poll GitHub releases API; persists last-check time to `update-check.json` |

### Cache Invalidation (OCR)

`tesseractOcrService` caches processed results as `<filename>.panopticon.json` alongside the source file. On the next call it:
1. Reads the cached JSON.
2. Compares `cached.metadata.mtime` and `cached.metadata.fileSize` against a live `fs.stat()`.
3. Re-processes if either value has changed.

---

## Data Files on Disk

| File | Location | Purpose |
|---|---|---|
| `settings.json` | `documents/Panopticon/settings.json` | All app config (directories, offlineMode) |
| `panopticon.directory.json` | Inside each indexed directory | File index, tags, bookmarks, exclusion patterns |
| `search-history.json` | `documents/Panopticon/saved-searches/search-history.json` | Recent searches |
| `saved-searches.json` | `documents/Panopticon/saved-searches/saved-searches.json` | Saved & named searches |
| `secure-storage.dat` | `userData/secure-storage.dat` | Encrypted key-value store |
| `update-check.json` | `userData/update-check.json` | Last update-check timestamp |
| `<file>.panopticon.json` | Next to each source document | OCR result cache |

`userData` resolves to:
- **Windows:** `%APPDATA%\panopticon`
- **macOS:** `~/Library/Application Support/panopticon`
- **Linux:** `~/.config/panopticon`

---

## Renderer (Vue SPA)

### Routing

Uses `createMemoryHistory` (no URL bar). Routes defined in `src/renderer/src/router/index.ts`:

| Path | View | Purpose |
|---|---|---|
| `/init` | `InitPage.vue` | First-run setup wizard |
| `/` | `Base.vue` | Full-text + tag search |
| `/library` | `Library.vue` | Directory management and indexing |
| `/bookmarks` | `Bookmarks.vue` | Bookmark browser |
| `/settings` | `Settings.vue` | App config: offline mode, per-directory settings |
| `/about` | `About.vue` | Version info, links |

`InitPage.vue` guards its own double-activation: on `onMounted` it calls `settingsFileExists()` and immediately navigates to `/` if settings are already present. An `isInitializing` flag prevents concurrent submissions.

### `window.api` in the Renderer

The renderer never imports from `src/main/`. All main-process capabilities arrive through `window.api`, which is available globally because the preload script calls `contextBridge.exposeInMainWorld('api', ...)`. TypeScript picks this up from the ambient declarations in `src/preload/index.d.ts`.

### Cross-View Communication (directory-added)

When a directory is added via `AddDirectoryDialog`, it dispatches a `CustomEvent('directory-added')` on `window`. `Library.vue` and `Bookmarks.vue` listen for this event and reload their data. Listeners are registered in `onMounted` and explicitly cleaned up in `onUnmounted`.

### `v-html` Usage

`Base.vue` renders search-result snippets with `v-html` to preserve highlight markup. The content is passed through `sanitizeSnippet()` first, which strips everything except `<mark>` tags before binding.

---

## Search (Base.vue)

Search uses [FlexSearch](https://github.com/nextapps-de/flexsearch) with a `Document` index.

1. On first search (or when the active directory changes), `buildSearchIndex()` scans all files in the directory config's `fileIndex` and builds a FlexSearch `Document` index plus a parallel plain array of `SearchDocument` objects.
2. Results are filtered by active tag selections client-side.
3. If the query text is empty but tags are selected, the tag filter runs directly over the plain array (no FlexSearch needed).
4. Snippets are generated by finding the search term in the raw page text and slicing a ±100-character window around it.

The index is cached in `cachedIndex` / `cachedDocuments` refs keyed by `cachedIndexKey` (`directoryId:directoryPath`). It is rebuilt whenever the key changes.

---

## PDF Rendering (EmbedPDF)

PDF rendering is handled by the `@embedpdf/*` plugin suite (pdfium WASM). The viewer lives in `src/renderer/src/components/EmbedPDFUI/` and is composed of thin wrapper components over the plugin API:

- `embedPDFMain.vue` — plugin initialisation and layout
- `PageControls.vue` / `PageIndicator.vue` / `ScrollToPage.vue` — navigation
- `ZoomControlsSimple.vue` — zoom
- `Search.vue` — in-document text search
- `Sidebar.vue` / `BookmarkButton.vue` / `CopyButton.vue` — sidebar and overlays

The composable `usePdfViewer.ts` manages plugin lifecycle and exposes the viewer API to its siblings.

For features requiring page *screenshots* (e.g. thumbnails), the main process spins up a hidden off-screen `BrowserWindow` (`pdf-screenshot-service.ts`) that renders pages via pdfium and returns BMP buffers.

---

## Build

```bash
pnpm dev          # dev server with HMR (main + renderer)
pnpm typecheck    # tsc (node) + vue-tsc (web), no emit
pnpm lint         # eslint --cache (prettier rules included)
pnpm format       # prettier --write
pnpm build        # typecheck → electron-vite build → bytecode compilation
pnpm build:win    # + electron-builder --win  (NSIS installer)
pnpm build:mac    # + electron-builder --mac  (DMG)
pnpm build:linux  # + electron-builder --linux (AppImage)
```

`prebuild` auto-runs `build-icons` (PNG → ICO via `scripts/generate-ico.js`).

`electron-vite` produces three bundles:
- `out/main/` — main process (CommonJS, bytecode-compiled)
- `out/preload/` — preload script (CommonJS, bytecode-compiled)
- `out/renderer/` — renderer (ESM SPA, Vite-optimised)

---

## Logger

`src/main/utils/logger.ts` exports named scoped loggers built on `electron-log`:

```typescript
import { logger, settingsLogger, watcherLogger, ocrLogger, searchLogger, indexLogger } from './utils/logger'
```

In production, logs are written to the platform's standard app-log directory. In development, they also stream to the terminal. Pass a scope name that matches the domain so log lines are easy to grep.

---

## Adding a New Feature — Checklist

1. **Shared type?** Add it to `src/shared/types.ts`.
2. **Business logic?** Create or extend a service in `src/main/services/`. Export a singleton.
3. **IPC channel?** Add `ipcMain.handle('domain:action', ...)` in the appropriate `src/main/ipc/*Handlers.ts` file. Guard any path argument with `isPathAllowed()`.
4. **Preload bridge?** Add the typed wrapper to `src/preload/index.ts` and its declaration to `src/preload/index.d.ts`.
5. **Renderer UI?** Call `window.api.domain.action()`. Clean up any push-channel listeners in `onUnmounted`.
6. **Typecheck + lint:** `pnpm typecheck && pnpm lint` must pass before committing.
