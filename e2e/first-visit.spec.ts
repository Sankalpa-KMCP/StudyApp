import { test, expect } from '@playwright/test'

const freshVisit = {
  cookies: [],
  origins: [] as Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>,
}

test.describe('first visit', () => {
  test.use({ storageState: freshVisit })

  test('shows onboarding then lands on focus with task input', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Skip onboarding tour' }).click()
    await expect(page.getByRole('textbox', { name: 'Add focus target' })).toBeVisible()
    await expect(page.getByPlaceholder('What do you want to focus on?')).toBeVisible()
  })

  test('onboarding final CTA focuses task input', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create your first focus target' }).click()
    await expect(page.getByRole('textbox', { name: 'Add focus target' })).toBeFocused()
  })

  test('skip tour shows first-session banner on focus tab', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Skip onboarding tour' }).click()
    await expect(page.getByTestId('first-session-banner')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Focus', exact: true })).toHaveAttribute('aria-current', 'page')
  })

  test('shows first-session banner after onboarding', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Create your first focus target' }).click()
    await expect(page.getByTestId('first-session-banner')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Got it' }).click()
    await expect(page.getByTestId('first-session-banner')).toHaveCount(0)
  })

  test('backdrop click does not dismiss onboarding', async ({ page }) => {
    await page.goto('/')
    const onboarding = page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })
    await expect(onboarding).toBeVisible({ timeout: 15000 })
    await page.getByLabel('Close dialog').click({ position: { x: 4, y: 4 } })
    await expect(onboarding).toBeVisible()
    await expect(page.getByRole('button', { name: 'Skip onboarding tour' })).toBeVisible()
  })
})

test.describe('first visit mobile', () => {
  test.use({
    storageState: freshVisit,
    viewport: { width: 375, height: 667 },
  })

  test('quick notes header button opens drawer', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('dialog', { name: 'Welcome to Study Dashboard' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Skip onboarding tour' }).click()
    await page.getByRole('button', { name: 'Quick Notes' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
