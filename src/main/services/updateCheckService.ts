import { app } from 'electron'
import * as path from 'path'
import { readFile, writeFile } from 'fs/promises'
import { compare } from 'semver'
import { logger } from '../utils/logger'

interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  downloadUrl?: string
  releaseNotes?: string
  error?: string
}

class UpdateCheckService {
  private readonly GITHUB_REPO = 'Andersang/Excavate' // Update with your GitHub username/repo
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours
  private _lastCheck = 0
  private readonly _statePath = path.join(app.getPath('userData'), 'update-check.json')

  /**
   * Check for updates if enough time has passed since last check
   */
  async checkForUpdatesIfNeeded(): Promise<UpdateCheckResult | null> {
    await this._loadLastCheck()

    const now = Date.now()
    if (now - this._lastCheck < this.CHECK_INTERVAL) {
      logger.debug('Skipping update check - checked recently')
      return null
    }

    this._lastCheck = now
    await this._saveLastCheck()
    return this.checkForUpdates()
  }

  /**
   * Force check for updates (ignoring time interval)
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      logger.info('Checking for updates from GitHub...')

      const response = await fetch(
        `https://api.github.com/repos/${this.GITHUB_REPO}/releases/latest`,
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Excavate-App'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`)
      }

      const latestRelease = await response.json()
      const latestVersion = latestRelease.tag_name.replace(/^v/, '') // Remove 'v' prefix if present
      const currentVersion = app.getVersion()

      logger.debug(`Current version: ${currentVersion}, Latest version: ${latestVersion}`)

      // Returns 1 if latest is newer, 0 if equal, -1 if older
      const comparison = compare(latestVersion, currentVersion)

      if (comparison > 0) {
        logger.info(`Update available: ${latestVersion}`)
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion,
          downloadUrl: latestRelease.html_url,
          releaseNotes: latestRelease.body
        }
      }

      logger.info('Application is up to date')
      return { hasUpdate: false, currentVersion }
    } catch (error) {
      logger.error('Update check failed:', error)
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Reset the last check time (useful for testing or manual refresh)
   */
  async resetLastCheck(): Promise<void> {
    this._lastCheck = 0
    await this._saveLastCheck()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _loadLastCheck(): Promise<void> {
    try {
      const raw = await readFile(this._statePath, 'utf-8')
      const data = JSON.parse(raw) as { lastCheck?: number }
      this._lastCheck = data.lastCheck ?? 0
    } catch {
      this._lastCheck = 0
    }
  }

  private async _saveLastCheck(): Promise<void> {
    try {
      await writeFile(this._statePath, JSON.stringify({ lastCheck: this._lastCheck }), 'utf-8')
    } catch (error) {
      logger.warn('Failed to persist update-check timestamp:', error)
    }
  }
}

export const updateCheckService = new UpdateCheckService()
