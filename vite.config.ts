import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { injectProductionCsp } from './src/security/csp.ts'

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))

function cspPlugin(mode: string): PluginOption {
  if (mode !== 'production') return null
  return {
    name: 'study-csp-plugin',
    transformIndexHtml(html: string) {
      return injectProductionCsp(html)
    },
  }
}

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()]
  const csp = cspPlugin(mode)
  if (csp) plugins.push(csp)

  return {
    base: mode === 'production' ? '/StudyApp/' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins,
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
  }
})
