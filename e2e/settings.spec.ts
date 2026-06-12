import { test, expect } from '@playwright/test'
import { settingsSectionNav } from './helpers/studyApp'

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

test('section nav scrolls to backup vault', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()

  await page.getByRole('button', { name: 'Data', exact: true }).click()
  await expect(page.locator('#settings-backup-vault')).toBeInViewport({ timeout: 5000 })
})

test('classic pomodoro preset updates timer summary', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()

  await settingsSectionNav(page).getByRole('button', { name: 'Focus', exact: true }).click()
  await page.locator('#settings-timer-focus').getByRole('button', { name: 'Classic' }).click()

  await expect(page.getByText(/25m focus · 5m break · 15m long · every 4 sessions/)).toBeVisible({ timeout: 5000 })
})
