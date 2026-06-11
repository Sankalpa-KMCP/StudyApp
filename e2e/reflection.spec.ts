import { test, expect } from '@playwright/test'

test('submits study reflection after completing a focus block', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Focus targets', { exact: true })).toBeVisible({ timeout: 15000 })

  await page.keyboard.press('Shift+C')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog.getByRole('button', { name: /save & continue/i })).toBeVisible()

  const note = 'E2E reflection note'
  await dialog.locator('textarea').fill(note)
  await dialog.getByRole('button', { name: /save & continue/i }).click()

  await expect(dialog).not.toBeVisible({ timeout: 10000 })
})

test('skips reflection with defaults', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.keyboard.press('Shift+C')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: /skip reflection/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
})
