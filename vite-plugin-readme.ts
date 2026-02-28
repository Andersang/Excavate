import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { Plugin } from 'vite'

/**
 * Vite plugin to import README.md as a string at build time
 */
export function readmePlugin(): Plugin {
  const virtualModuleId = 'virtual:readme'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'vite-plugin-readme',
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId
      }
      return null
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        const readmePath = resolve(__dirname, 'README.md')
        const content = readFileSync(readmePath, 'utf-8')
        return `export default ${JSON.stringify(content)}`
      }
      return null
    }
  }
}
