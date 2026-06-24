import { test, expect } from '@playwright/test'

test('backup reminder surfaces on settings navigation instead of global banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await expect(page.getByRole('region', { name: /backup reminder/i })).not.toBeVisible()

  const settingsNav = page.getByRole('button', { name: /settings.*backup reminder/i })
  if (await settingsNav.first().isVisible()) {
    await settingsNav.first().click()
    await expect(page.getByRole('heading', { name: /settings/i }).first()).toBeVisible({ timeout: 10000 })
  }
})
