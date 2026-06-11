import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: [
        'src/components/control-deck/**/*.test.{ts,tsx}',
        'src/components/shared/settings/**/*.test.{ts,tsx}',
      ],
      coverage: {
        provider: 'v8',
        include: [
          'src/components/control-deck/*.tsx',
          'src/components/shared/settings/*.tsx',
        ],
        exclude: [
          'src/components/control-deck/**/*.test.{ts,tsx}',
          'src/components/control-deck/**/*.stories.tsx',
          'src/components/shared/settings/**/*.test.{ts,tsx}',
          'src/components/shared/settings/**/*.stories.tsx',
          'src/test/**',
        ],
        thresholds: {
          lines: 60,
          branches: 45,
        },
      },
    },
  }),
)
