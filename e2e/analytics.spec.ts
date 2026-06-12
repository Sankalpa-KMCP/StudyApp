import { test, expect } from '@playwright/test'

test('opens analytics tab with lazy-loaded content', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Analytics' }).first().click()
  await expect(
    page.getByText(/loading analytics/i)
      .or(page.getByText('Monthly Study Time'))
      .or(page.getByText('No study data yet')),
  ).toBeVisible({ timeout: 15000 })
  await expect(
    page.getByText(/monthly study time|no study data yet|weekly performance trends/i).first(),
  ).toBeVisible({ timeout: 20000 })
})
