import { test, expect } from '@playwright/test'

test('creates a focus task', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Focus targets')).toBeVisible({ timeout: 15000 })
  const input = page.getByPlaceholder('Create focus target...')
  await input.fill('E2E test task')
  await input.press('Enter')
  await expect(page.getByText('E2E test task')).toBeVisible({ timeout: 10000 })
})
