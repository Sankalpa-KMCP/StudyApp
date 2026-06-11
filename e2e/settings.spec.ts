import { test, expect } from '@playwright/test'

test('navigates to settings tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await expect(page.getByText(/aesthetics|backup vault|dark presets/i).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 })
})

test('switches light preset via swatch and updates data-theme-mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()

  await page.getByRole('button', { name: 'Linen Warm' }).click()

  await expect(page.locator('div.min-h-screen[data-theme-mode="light"]')).toBeVisible({ timeout: 5000 })
})

test('switches dark preset via swatch and updates data-theme-mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()

  await page.getByRole('button', { name: 'Forest Dusk' }).click()

  await expect(page.locator('div.min-h-screen[data-theme-mode="dark"]')).toBeVisible({ timeout: 5000 })
})
