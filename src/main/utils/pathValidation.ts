import path from 'path'
import { realpathSync } from 'fs'
import { app } from 'electron'
import { settingsService } from '../services/settingsService'

function safeRealpath(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

/**
 * Cache allowed roots for a single operation to prevent TOCTOU vulnerabilities.
 * Call this at the start of an operation and reuse the returned roots.
 */
export function getAllowedRoots(): string[] {
  return [
    ...Object.values(settingsService.getDirectories()).map((d) => safeRealpath(d.path)),
    safeRealpath(app.getPath('userData')),
    safeRealpath(path.join(app.getPath('documents'), 'Panopticon'))
  ]
}

/**
 * Determine whether a given file-system path is within an allowed root.
 *
 * Allowed roots are:
 * - Every directory path currently registered in settings
 * - The Electron `userData` directory (for processed JSON, settings, etc.)
 * - `<Documents>/Panopticon` (legacy / first-run location)
 *
 * @param filePath - Absolute or relative path supplied by the renderer.
 * @param cachedRoots - Optional pre-cached allowed roots to prevent TOCTOU issues.
 *
 * @remarks
 * For operations that validate multiple paths, call `getAllowedRoots()` once
 * at the start and pass the result as `cachedRoots` to avoid race conditions
 * where directories are added/removed during the operation.
 *
 * Symlink policy: Resolved paths are compared, so symlinks to allowed
 * directories are permitted. If stricter control is needed, additional
 * checks should be added at the caller level.
 */
export function isPathAllowed(filePath: string, cachedRoots?: string[]): boolean {
  const resolved = safeRealpath(filePath)
  const allowedRoots = cachedRoots ?? getAllowedRoots()
  return allowedRoots.some((root) => resolved.startsWith(root + path.sep) || resolved === root)
}
