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
          'src/lib/study/studyDashboard/**',
          'src/lib/settings/settingsValidation.ts',
          'src/lib/settings/settingsSections.ts',
          'src/lib/desktop/focusNotifications.ts',
          'src/lib/backup/backupChecksum.ts',
          'src/lib/backup/backupExport.ts',
          'src/lib/shared/copyDebugInfo.ts',
          'src/lib/shared/dateConstants.ts',
          'src/lib/theme/theme.ts',
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
