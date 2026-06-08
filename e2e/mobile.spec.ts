import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

const TABS = ['Focus', 'Cards', 'Analytics', 'Journal', 'Settings'] as const

test('mobile tab bar navigates all main tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  for (const tab of TABS) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
  }

  await page.getByRole('button', { name: 'Analytics', exact: true }).click()
  await expect(page.getByText(/loading analytics|monthly study time/i).first()).toBeVisible({ timeout: 15000 })
})
