import { test, expect } from '@playwright/test'

test('loads focus tab and shows study dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /start|focus|study/i }).first()).toBeVisible()
})
