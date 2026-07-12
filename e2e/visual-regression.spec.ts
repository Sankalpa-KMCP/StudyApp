import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers/studyApp'

test.use({ viewport: { width: 1280, height: 720 } })

const tabs = [
  { name: 'Focus', marker: /what do you want to focus on|add focus target/i },
  { name: 'Analytics', marker: /monthly study time|loading analytics/i },
  { name: 'Journal', marker: /day journal|loading journal/i },
  { name: 'Settings', marker: /zen lockout|loading settings/i },
] as const

for (const tab of tabs) {
  test(`visual snapshot: ${tab.name} tab`, async ({ page }) => {
    await waitForAppReady(page)
    await page.getByRole('button', { name: tab.name }).first().click()
    await expect(page.getByText(tab.marker).first()).toBeVisible({ timeout: 20000 })
    if (tab.name === 'Settings') {
      await page.getByRole('button', { name: 'Dismiss backup reminder' }).click({ timeout: 2000 }).catch(() => {})
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        document.querySelector('main')?.scrollTo(0, 0)
      })
      await page.waitForTimeout(400)
    }
    await expect(page.locator('main')).toHaveScreenshot(`tab-${tab.name.toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.02,
    })
  })
}
