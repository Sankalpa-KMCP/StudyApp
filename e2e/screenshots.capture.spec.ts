import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'docs', 'screenshots')

test.use({ viewport: { width: 1280, height: 720 } })

test.describe.configure({ mode: 'serial' })

test('capture readme screenshots', async ({ page }) => {
  fs.mkdirSync(outDir, { recursive: true })

  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: path.join(outDir, 'focus.png'), fullPage: false })

  await page.getByRole('button', { name: 'Cards' }).first().click()
  await expect(page.getByText(/loading recall deck|flashcards registry/i).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Flashcards Registry')).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: path.join(outDir, 'cards.png'), fullPage: false })

  await page.getByRole('button', { name: 'Analytics' }).first().click()
  await expect(
    page.getByText(/loading analytics/i).or(page.getByText('Monthly Study Time')),
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Monthly Study Time')).toBeVisible({ timeout: 20000 })
  await page.screenshot({ path: path.join(outDir, 'analytics.png'), fullPage: false })

  await page.getByRole('button', { name: 'Settings' }).first().click()
  await expect(page.locator('#settings-timer-focus')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('#settings-sound-feedback')).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(outDir, 'settings.png'), fullPage: false })
})
