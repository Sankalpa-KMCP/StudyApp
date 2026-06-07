import { test, expect } from '@playwright/test'

test('submits study reflection after completing a focus block', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Focus targets')).toBeVisible({ timeout: 15000 })

  await page.keyboard.press('c')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog.getByRole('button', { name: /save session/i })).toBeVisible()

  const note = 'E2E reflection note'
  await dialog.locator('textarea').fill(note)
  await dialog.getByRole('button', { name: /save session/i }).click()

  await expect(dialog).not.toBeVisible({ timeout: 10000 })
  await expect(page.getByText('FOCUS BLOCK COMPLETED')).toBeVisible({ timeout: 10000 })
})
