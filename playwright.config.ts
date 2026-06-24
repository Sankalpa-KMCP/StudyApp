import { defineConfig, devices } from '@playwright/test'

const syncTests = '**/folder-sync*.spec.ts'
const visualTests = '**/visual-regression.spec.ts'

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/screenshots.capture.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
    },
  },
  snapshotPathTemplate: '{testDir}/visual-baselines/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'sanctuary_onboarding_completed', value: 'true' },
            { name: 'sidebar_collapsed', value: 'false' },
          ],
        },
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [visualTests, syncTests],
    },
    {
      name: 'mobile-chrome',
      testMatch: 'mobile.spec.ts',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: [visualTests, syncTests],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: [visualTests, syncTests],
    },
    {
      name: 'visual',
      testMatch: 'visual-regression.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e-sync',
      testMatch: /folder-sync.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_E2E_SYNC: '1',
    },
  },
})

