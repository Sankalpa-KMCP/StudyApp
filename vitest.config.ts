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
          'src/lib/studyDashboard.ts',
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
        ],
        exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.stories.tsx', 'src/test/**'],
        thresholds: {
          lines: 75,
          functions: 75,
          branches: 60,
          statements: 75,
        },
      },
    },
  }),
)
