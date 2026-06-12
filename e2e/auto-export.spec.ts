import { test, expect } from '@playwright/test'
import { openSettingsTab, settingsSectionNav, waitForAppReady } from './helpers/studyApp'

test('auto-export toggle persists in settings', async ({ page }) => {
  await waitForAppReady(page)

  await openSettingsTab(page)
  await settingsSectionNav(page).getByRole('button', { name: 'Data', exact: true }).click()

  const toggle = page.getByRole('switch', { name: 'Auto-export vault' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await waitForAppReady(page)
  await openSettingsTab(page)
  await settingsSectionNav(page).getByRole('button', { name: 'Data', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Auto-export vault' })).toHaveAttribute('aria-checked', 'true')
})
