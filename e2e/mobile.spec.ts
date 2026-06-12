import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 375, height: 667 } })

const TABS = ['Focus', 'Analytics', 'Journal', 'Settings'] as const

test('mobile tab bar navigates all main tabs', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  for (const tab of TABS) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
  }

  await page.getByRole('button', { name: 'Analytics', exact: true }).click()
  await expect(page.getByText(/loading analytics|monthly study time|no study data yet/i).first()).toBeVisible({ timeout: 15000 })
})

test('mobile focus shows compact timer and task input', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  if (await page.getByRole('button', { name: 'Skip onboarding tour' }).isVisible()) {
    await page.getByRole('button', { name: 'Skip onboarding tour' }).click()
  }
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Adjust length' })).toBeVisible()
  await expect(page.getByPlaceholder('What do you want to focus on?')).toBeVisible()
})
