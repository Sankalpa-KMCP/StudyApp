import { test, expect } from '@playwright/test'

test('shows backup vault export in settings', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await expect(page.getByRole('button', { name: /export vault/i })).toBeVisible({ timeout: 10000 })
})
