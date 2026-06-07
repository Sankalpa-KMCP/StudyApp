import { test, expect } from '@playwright/test'

test('keyboard shortcuts modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /keyboard shortcuts/i }).click()
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeVisible()
})

test('space toggles timer on focus tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /focus/i }).filter({ visible: true }).first().click()
  const playButton = page.getByRole('button', { name: /start|pause|resume timer/i }).first()
  await expect(playButton).toBeVisible({ timeout: 10000 })
  const labelBefore = await playButton.getAttribute('aria-label')
  await page.keyboard.press('Space')
  await expect(playButton).not.toHaveAttribute('aria-label', labelBefore ?? '', { timeout: 5000 })
})
