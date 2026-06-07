import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

test('imports backup vault after confirm dialog', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Focus targets')).toBeVisible({ timeout: 15000 })

  const taskName = 'Round-trip backup task'
  const input = page.getByPlaceholder('Create focus target...')
  await input.fill(taskName)
  await input.press('Enter')
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /export vault/i }).click()
  const download = await downloadPromise
  const backupPath = path.join(os.tmpdir(), `study-backup-${Date.now()}.studybackup`)
  await download.saveAs(backupPath)

  await page.getByRole('button', { name: /focus/i }).filter({ visible: true }).first().click()
  await input.fill('Stale task after export')
  await input.press('Enter')
  await expect(page.getByText('Stale task after export')).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await page.locator('input[type="file"][accept*=".studybackup"]').setInputFiles(backupPath)

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /^import$/i }).click()

  await page.waitForLoadState('load')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(taskName)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Stale task after export')).not.toBeVisible()

  fs.unlinkSync(backupPath)
})
