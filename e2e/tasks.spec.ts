import { test, expect } from '@playwright/test'

test('creates a focus task', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Focus targets', { exact: true })).toBeVisible({ timeout: 15000 })
  const input = page.getByPlaceholder('What do you want to focus on?').first()
  await input.fill('E2E test task')
  await input.press('Enter')
  await expect(page.getByText('E2E test task').first()).toBeVisible({ timeout: 10000 })
})
