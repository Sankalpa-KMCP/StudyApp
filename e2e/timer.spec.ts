import { test, expect } from '@playwright/test'

test('starts and pauses focus timer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  const startBtn = page.getByRole('button', { name: /start timer/i })
  await startBtn.click()
  const pauseBtn = page.getByRole('button', { name: /pause timer/i })
  await expect(pauseBtn).toBeVisible({ timeout: 5000 })
  await pauseBtn.click()
  await expect(page.getByRole('button', { name: /start timer/i })).toBeVisible()
})
