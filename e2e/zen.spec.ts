import { test, expect } from '@playwright/test'

test('enters zen sanctuary during active timer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /start timer|pause timer/i }).first().click()
  await page.getByRole('button', { name: /sanctuary mode/i }).click()

  await expect(page.getByText(/deep study|resting/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /complete focus/i })).toBeVisible()
})

test('zen lockout blocks exit when enforce lockout is on', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Settings' }).first().click()
  await expect(page.getByText('Zen Lockout')).toBeVisible({ timeout: 20000 })
  const lockoutToggle = page.getByRole('switch', { name: /enforced|bypassed/i })
  if (await lockoutToggle.getAttribute('aria-checked') !== 'true') {
    await lockoutToggle.click()
    await expect(lockoutToggle).toHaveAttribute('aria-checked', 'true')
  }

  await page.getByRole('button', { name: 'Focus' }).first().click()
  await page.getByRole('button', { name: /start timer|pause timer/i }).first().click()
  await page.getByRole('button', { name: /sanctuary mode/i }).click()

  await expect(page.getByText(/deep study/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /exit/i })).toHaveCount(0)
})
