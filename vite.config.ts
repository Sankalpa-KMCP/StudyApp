import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

export default defineConfig(({ mode }) => {
  return {
    base: mode === 'production' ? '/StudyApp/' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['manifest.webmanifest'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: 'index.html',
        },
        devOptions: {
          enabled: false,
        },
      }),
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
