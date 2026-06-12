import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

test('cancelling backup import leaves current data unchanged', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  const taskName = 'Cancel-import anchor task'
  const input = page.getByPlaceholder('What do you want to focus on?')
  await input.fill(taskName)
  await input.press('Enter')
  await expect(page.getByText(taskName).first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /export vault/i }).click()
  const download = await downloadPromise
  const backupPath = path.join(os.tmpdir(), `study-backup-cancel-${Date.now()}.studybackup`)
  await download.saveAs(backupPath)

  await page.getByRole('button', { name: /focus/i }).filter({ visible: true }).first().click()
  const staleTask = 'Stale task should survive cancel'
  await input.fill(staleTask)
  await input.press('Enter')
  await expect(page.getByText(staleTask).first()).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await page.locator('input[type="file"][accept*=".studybackup"]').setInputFiles(backupPath)

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /^cancel$/i }).click()
  await expect(dialog).not.toBeVisible()

  await page.getByRole('button', { name: /focus/i }).filter({ visible: true }).first().click()
  await expect(page.getByText(staleTask).first()).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(taskName).first()).toBeVisible()

  fs.unlinkSync(backupPath)
})
