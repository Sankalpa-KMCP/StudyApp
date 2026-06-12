import { test, expect } from '@playwright/test'

test('analytics range selector updates productivity window label', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /^analytics$/i }).click()
  await expect(page.getByText(/loading analytics/i)).toBeVisible({ timeout: 5000 }).catch(() => {})
  await expect(page.getByRole('group', { name: /analytics time range/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /last 7 days/i }).click()
  await expect(page.getByText(/productivity metrics below reflect last 7 days/i)).toBeVisible()
})
