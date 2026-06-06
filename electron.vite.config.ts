import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'
import { readmePlugin } from './vite-plugin-readme'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), bytecodePlugin()]
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
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [vue(), tailwindcss(), tsconfigPaths(), readmePlugin()]
  }
})
