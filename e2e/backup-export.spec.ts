import { test, expect } from '@playwright/test'
import { openSettingsTab } from './helpers/studyApp'

test('exports backup vault download', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /export vault/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^study-vault-\d{4}-\d{2}-\d{2}\.studybackup$/)
})
