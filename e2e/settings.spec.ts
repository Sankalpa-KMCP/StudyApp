import { test, expect } from '@playwright/test'
import { openSettingsTab, settingsSectionNav } from './helpers/studyApp'

test('navigates to settings tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)
  await expect(page.getByText(/aesthetics|backup vault|dark presets/i).filter({ visible: true }).first()).toBeVisible({ timeout: 10000 })
})

test('switches light preset via swatch and updates data-theme-mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)

  await page.getByRole('button', { name: 'Linen Warm' }).click()

  await expect(page.locator('div.min-h-screen[data-theme-mode="light"]')).toBeVisible({ timeout: 5000 })
})

test('switches dark preset via swatch and updates data-theme-mode', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)

  await page.getByRole('button', { name: 'Forest Dusk' }).click()

  await expect(page.locator('div.min-h-screen[data-theme-mode="dark"]')).toBeVisible({ timeout: 5000 })
})

test('section nav scrolls to backup vault', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)

  await page.getByRole('button', { name: 'Data', exact: true }).click()
  await expect(page.locator('#settings-backup-vault')).toBeInViewport({ timeout: 5000 })
})

test('advanced panels hidden until toggle is enabled', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)

  await expect(page.locator('#settings-zen-lockout')).toHaveCount(0)
  await expect(page.locator('#settings-algorithm')).toHaveCount(0)

  await page.getByRole('switch', { name: 'Show advanced settings' }).click()

  await expect(page.locator('#settings-zen-lockout')).toBeVisible({ timeout: 5000 })
  await settingsSectionNav(page).getByRole('button', { name: 'Study', exact: true }).click()
  await expect(page.locator('#settings-algorithm')).toBeInViewport({ timeout: 5000 })
})

test('pending scroll to advanced panel auto-enables advanced settings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sanctuary_onboarding_completed', 'true')
    localStorage.setItem('settings_show_advanced', 'false')
    sessionStorage.setItem('pending_settings_scroll', 'settings-zen-lockout')
  })
  await page.goto('/')
  await openSettingsTab(page)
  await expect(page.getByRole('switch', { name: 'Show advanced settings' })).toBeChecked({ timeout: 5000 })
  await expect(page.locator('#settings-zen-lockout')).toBeVisible({ timeout: 5000 })
})

test('classic pomodoro preset updates timer summary', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await openSettingsTab(page)

  await settingsSectionNav(page).getByRole('button', { name: 'Focus', exact: true }).click()
  await page.locator('#settings-timer-focus').getByRole('button', { name: 'Classic' }).click()

  await expect(page.getByText(/25m focus · 5m break · 15m long · every 4 sessions/)).toBeVisible({ timeout: 5000 })
})
