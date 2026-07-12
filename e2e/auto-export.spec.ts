import { test, expect } from '@playwright/test'
import { openSettingsTab, settingsSectionNav, waitForAppReady } from './helpers/studyApp'

async function openAutoExportToggle(page: import('@playwright/test').Page) {
  await openSettingsTab(page)
  await settingsSectionNav(page).getByRole('button', { name: 'Data', exact: true }).click()
  await page.getByRole('button', { name: 'Advanced backup & data tools' }).click()
  return page.getByRole('switch', { name: 'Auto-export vault' })
}

test('auto-export toggle persists in settings', async ({ page }) => {
  await waitForAppReady(page)

  const toggle = await openAutoExportToggle(page)
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await waitForAppReady(page)
  const toggleAfterReload = await openAutoExportToggle(page)
  await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true')
})
