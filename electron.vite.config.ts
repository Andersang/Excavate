import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
// import { copyFileSync, existsSync, mkdirSync } from 'fs'
import tsconfigPaths from 'vite-tsconfig-paths'
import { readmePlugin } from './vite-plugin-readme'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      bytecodePlugin()
      // No PDFium WASM copying needed when using Chromium's built-in viewer
    ]
  },
  preload: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve(__dirname, './src/renderer/src')
      }
    },
    publicDir: resolve(__dirname, 'public'),
    plugins: [vue(), tailwindcss(), tsconfigPaths(), readmePlugin()]
  }
})
