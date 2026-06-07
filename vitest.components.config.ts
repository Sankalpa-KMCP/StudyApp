import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: [
        'src/components/shared/**/*.test.{ts,tsx}',
        'src/components/analytics/**/*.test.{ts,tsx}',
      ],
      coverage: {
        provider: 'v8',
        include: [
          'src/components/shared/Button.tsx',
          'src/components/shared/Card.tsx',
          'src/components/shared/ModalShell.tsx',
          'src/components/shared/EmptyState.tsx',
          'src/components/shared/ConfirmDialog.tsx',
          'src/components/shared/settings/RangeSetting.tsx',
          'src/components/shared/settings/SettingsCard.tsx',
          'src/components/shared/settings/ToggleSetting.tsx',
          'src/components/analytics/SummaryMetricsRow.tsx',
        ],
        exclude: ['src/**/*.stories.tsx', 'src/test/**'],
        thresholds: {
          lines: 50,
          functions: 50,
          branches: 40,
          statements: 50,
        },
      },
    },
  }),
)
