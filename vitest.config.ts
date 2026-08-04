import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    esbuild: {
      jsx: 'automatic',
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: [
          'src/App.tsx',
          'src/hooks/useThemePreference.ts',
          'src/hooks/useSidebarPreference.ts',
          'src/hooks/useAppSearch.ts',
          'src/hooks/useFocusSession.ts',
        ],
        exclude: ['src/**/*.test.tsx', 'src/**/*.test.ts', 'src/test/**'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  }),
)
