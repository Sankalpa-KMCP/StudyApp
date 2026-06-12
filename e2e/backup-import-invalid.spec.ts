import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

test('rejects malformed backup import without changing tasks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  const anchorTask = 'Invalid import anchor task'
  const input = page.getByPlaceholder('What do you want to focus on?')
  await input.fill(anchorTask)
  await input.press('Enter')
  await expect(page.getByText(anchorTask).first()).toBeVisible({ timeout: 10000 })

  const badPath = path.join(os.tmpdir(), `study-bad-${Date.now()}.studybackup`)
  fs.writeFileSync(badPath, '{ not valid json')

  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await page.locator('input[type="file"][accept*=".studybackup"]').setInputFiles(badPath)

  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 10000 })
  await confirm.getByRole('button', { name: /^import$/i }).click()

  await expect(page.getByText(/invalid backup/i)).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: /focus/i }).filter({ visible: true }).first().click()
  await expect(page.getByText(anchorTask).first()).toBeVisible({ timeout: 10000 })

  fs.unlinkSync(badPath)
})
