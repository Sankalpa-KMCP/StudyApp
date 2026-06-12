import { test, expect } from '@playwright/test'
import { openSettingsTab } from './helpers/studyApp'

test('shows backup vault export in settings', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)
  await expect(page.getByRole('button', { name: /export vault/i })).toBeVisible({ timeout: 10000 })
})
