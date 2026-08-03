import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, waitForSettledHome } from './a11yHelpers'

test.use({
  reducedMotion: 'reduce',
})

test.describe('Playwright axe accessibility smoke', () => {
  test('Home baseline and open Notifications popover pass WCAG A/AA axe scans', async ({ page }, testInfo) => {
    await waitForSettledHome(page)

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expectNoAxeViolations(page, testInfo, 'home-baseline')

    const notices = page.getByRole('button', { name: 'Notifications' })
    await notices.click()
    await expect(notices).toHaveAttribute('aria-expanded', 'true')

    const popover = page.locator('#notice-popover')
    await expect(popover).toBeVisible()
    await expect(popover).toHaveAttribute('role', 'status')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await expectNoAxeViolations(page, testInfo, 'home-notifications-open')

    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(notices).toHaveAttribute('aria-expanded', 'false')
    await expect(notices).toBeFocused()
  })

  test('Settings and inline clear confirmation pass WCAG A/AA axe scans without deleting data', async ({ page }, testInfo) => {
    await waitForSettledHome(page)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Monochrome/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Export data/i })).toBeVisible()
    await expect(page.getByLabel(/Import data/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Reset all study data/i })).toBeVisible()

    await expectNoAxeViolations(page, testInfo, 'settings-baseline')

    await page.getByRole('button', { name: /Reset all study data/i }).click()
    await expect(page.getByText('Confirm data deletion')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete all data' })).toBeDisabled()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const confirmInput = page.getByPlaceholder('DELETE')
    await expect(confirmInput).toBeVisible()
    // Accessible name may come from placeholder; keep the control discoverable without clearing data.
    await expect(confirmInput).toHaveAttribute('placeholder', 'DELETE')

    await expectNoAxeViolations(page, testInfo, 'settings-clear-confirm')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: /Reset all study data/i })).toBeVisible()
    await expect(page.getByText('Confirm data deletion')).toHaveCount(0)
  })
})
