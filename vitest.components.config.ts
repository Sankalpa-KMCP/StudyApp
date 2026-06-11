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
          'src/components/shared/TabPageShell.tsx',
          'src/components/shared/TabLoadingFallback.tsx',
          'src/components/shared/MetricCard.tsx',
          'src/components/shared/PanelCard.tsx',
          'src/components/shared/PanelHeader.tsx',
          'src/components/shared/settings/RangeSetting.tsx',
          'src/components/shared/settings/SettingsCard.tsx',
          'src/components/shared/settings/ToggleSetting.tsx',
          'src/components/shared/settings/SettingsPresetChips.tsx',
          'src/components/analytics/SummaryMetricsRow.tsx',
        ],
        exclude: ['src/**/*.stories.tsx', 'src/test/**'],
        thresholds: {
          lines: 65,
          functions: 65,
          branches: 50,
          statements: 65,
        },
      },
    },
  }),
)
