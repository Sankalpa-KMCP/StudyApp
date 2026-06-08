import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 720 } })

const tabs = [
  { name: 'Focus', marker: /focus timer|focus targets/i },
  { name: 'Cards', marker: /flashcards registry|loading recall deck/i },
  { name: 'Analytics', marker: /monthly study time|loading analytics/i },
  { name: 'Journal', marker: /day journal|loading journal/i },
  { name: 'Settings', marker: /zen lockout|loading settings/i },
] as const

for (const tab of tabs) {
  test(`visual snapshot: ${tab.name} tab`, async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: tab.name }).first().click()
    await expect(page.getByText(tab.marker).first()).toBeVisible({ timeout: 20000 })
    await expect(page.locator('main')).toHaveScreenshot(`tab-${tab.name.toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.02,
    })
  })
}
