import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { openSettingsTab, waitForAppReady } from './helpers/studyApp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'screenshots')

test.use({ viewport: { width: 1280, height: 720 } })

test.describe.configure({ mode: 'serial' })

test('capture readme screenshots', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true })

  await waitForAppReady(page)
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(outDir, 'focus.png'), fullPage: false })

  await page.getByRole('button', { name: 'Analytics' }).first().click()
  const analyticsReady = page
    .getByText(/loading analytics/i)
    .or(page.getByText('Monthly Study Time'))
    .or(page.getByText('No study data yet'))
  await expect(analyticsReady).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: path.join(outDir, 'analytics.png'), fullPage: false })

  await page.getByRole('button', { name: 'Journal' }).first().click()
  const journalReady = page
    .getByText(/loading journal/i)
    .or(page.getByText('Day Journal'))
  await expect(journalReady).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: path.join(outDir, 'journal.png'), fullPage: false })

  await openSettingsTab(page)
  await expect(page.locator('#settings-timer-focus')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('#settings-sound-feedback')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, 'settings.png'), fullPage: false })
})
