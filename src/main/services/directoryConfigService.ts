import { readFile, writeFile, access } from 'fs/promises'
import { join } from 'path'
import type { DirectoryConfig } from '../../shared/types'

const CONFIG_FILE_NAME = 'Excavate.directory.json'

const EMPTY_CONFIG: DirectoryConfig = {
  createdAt: '',
  updatedAt: '',
  fileTypes: [],
  fileCount: 0,
  fileIndex: [],
  customExclusionPatterns: [],
  allTags: [],
  bookmarks: []
}

class DirectoryConfigService {
  configPath(directoryPath: string): string {
    return join(directoryPath, CONFIG_FILE_NAME)
  }

  async exists(directoryPath: string): Promise<boolean> {
    try {
      await access(this.configPath(directoryPath))
      return true
    } catch {
      return false
    }
  }

  async read(directoryPath: string): Promise<DirectoryConfig> {
    try {
      const content = await readFile(this.configPath(directoryPath), 'utf-8')
      return JSON.parse(content) as DirectoryConfig
    } catch {
      return { ...EMPTY_CONFIG }
    }
  }

  async write(directoryPath: string, config: DirectoryConfig): Promise<void> {
    await writeFile(this.configPath(directoryPath), JSON.stringify(config, null, 2), 'utf-8')
  }
}

export const directoryConfigService = new DirectoryConfigService()
