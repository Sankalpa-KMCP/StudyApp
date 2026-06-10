import { test, expect } from '@playwright/test'

test('navigates to settings tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await expect(page.getByText(/aesthetics|backup vault|theme mode/i).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 })
})

test('switches light preset and updates data-theme-mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()

  const themeSelect = page.locator('select').filter({ hasText: /match system|midnight slate/i }).first()
  await themeSelect.selectOption('paper-day')

  await expect(page.locator('[data-theme-mode="light"]')).toBeVisible({ timeout: 5000 })
})
