import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import development from './playwright.config'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['productionSmoke.spec.ts', 'startupEntrance.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4175/StudyApp/', trace: 'retain-on-failure' },
  projects: development.projects?.map(project => ({
    ...project,
    testMatch: ['productionSmoke.spec.ts', 'startupEntrance.spec.ts'],
    use: {
      ...project.use,
      ...(['chromium', 'mobile-chrome'].includes(project.name ?? '') && process.env.STUDY_TEST_CHROMIUM_EXECUTABLE
        ? { launchOptions: { executablePath: process.env.STUDY_TEST_CHROMIUM_EXECUTABLE } } : {}),
    },
  })),
  webServer: {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    command: 'node scripts/serve-production.mjs',
    url: 'http://127.0.0.1:4175/StudyApp/',
    reuseExistingServer: false,
  },
})
