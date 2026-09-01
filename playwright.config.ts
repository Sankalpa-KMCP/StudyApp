import { defineConfig, devices } from '@playwright/test'

const SMOKE_SPECS = [
  '**/navigation.spec.ts',
  '**/dashboard.spec.ts',
  '**/focus-persistence.spec.ts',
  '**/dataCoordinator.spec.ts',
  '**/a11y.spec.ts',
]

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'firefox',
      testMatch: SMOKE_SPECS,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: SMOKE_SPECS,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-webkit',
      testMatch: SMOKE_SPECS,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
})
