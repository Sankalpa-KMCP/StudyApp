import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

export default defineConfig(({ mode }) => {
  return {
    base: mode === 'production' ? '/StudyApp/' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
    ],
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/dexie')) return 'vendor-dexie'
          },
        },
      },
    },
  };
})
