import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig({ mode: 'test', command: 'serve' }),
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: [
          'src/lib/studyDashboard/**',
          'src/lib/settingsValidation.ts',
          'src/lib/settingsSections.ts',
          'src/lib/focusNotifications.ts',
          'src/lib/backupChecksum.ts',
          'src/lib/backupExport.ts',
          'src/lib/copyDebugInfo.ts',
          'src/lib/dateConstants.ts',
          'src/lib/theme.ts',
          'src/db/selectors/**',
          'src/db/hooks/**',
          'src/db/repositories/**',
          'src/db/db.ts',
          'src/hooks/useJournalCalendar.ts',
          'src/hooks/useAppToast.ts',
          'src/hooks/useGamification.ts',
          'src/hooks/useCategoriesMap.ts',
          'src/hooks/useFocusTrap.ts',
          'src/hooks/useTimerEngine.ts',
          'src/hooks/useSessionBackup.ts',
          'src/hooks/useDashboardData.ts',
          'src/hooks/useSettingsUpdater.ts',
          'src/hooks/useDebouncedCallback.ts',
        ],
        exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'src/test/**'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 74,
          statements: 80,
        },
      },
    },
  }),
)
