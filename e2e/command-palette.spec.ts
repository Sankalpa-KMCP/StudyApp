import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers/studyApp'

test('opens command palette with Ctrl+K and navigates to settings', async ({ page }) => {
  await waitForAppReady(page)

  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  await expect(page.getByLabel('Search commands')).toBeFocused()

  await page.getByLabel('Search commands').fill('settings')
  await page.getByRole('option', { name: /Settings/i }).first().click()

  await expect(page.getByText(/zen lockout|timer & focus|loading settings/i).first()).toBeVisible({ timeout: 15000 })
})
