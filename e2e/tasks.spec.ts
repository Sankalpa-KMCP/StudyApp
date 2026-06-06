import { test, expect } from '@playwright/test'

test('creates a focus task', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  const input = page.getByPlaceholder('Create focus target...')
  await input.fill('E2E test task')
  await page.getByRole('button').filter({ has: page.locator('svg') }).first().click()
  await expect(page.getByText('E2E test task')).toBeVisible({ timeout: 10000 })
})
