import { test, expect } from '@playwright/test'

test('backup reminder banner can be dismissed', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  const reminder = page.getByRole('region', { name: /backup reminder/i })
  if (await reminder.isVisible()) {
    await page.getByRole('button', { name: /dismiss backup reminder/i }).click()
    await expect(reminder).not.toBeVisible()
  }
})
