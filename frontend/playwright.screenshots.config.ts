import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'screenshots.capture.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL.replace(/\/$/, ''),
          localStorage: [
            { name: 'sanctuary_onboarding_completed', value: 'true' },
            { name: 'sidebar_collapsed', value: 'false' },
          ],
        },
      ],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.SCREENSHOT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
      },
})
