import { test, expect } from '@playwright/test'

test('navigates to settings tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /settings/i }).first().click()
  await expect(page.getByText(/backup|export|theme/i).first()).toBeVisible({ timeout: 10000 })
})
