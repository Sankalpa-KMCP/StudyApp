import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;
  return {
    base: isTauri ? '/' : (mode === 'production' ? '/StudyApp/' : '/'),
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
            if (id.includes('node_modules/lucide-react')) return 'vendor-lucide'
          },
        },
      },
    },
  };
})
