import { test, expect } from '@playwright/test'

test('keyboard shortcuts modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /keyboard shortcuts/i }).click()
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeVisible()
})

test('space toggles timer on focus tab', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  const onboarding = page.getByRole('dialog', { name: /welcome to study dashboard/i })
  if (await onboarding.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Skip onboarding tour' }).click()
  }
  const playButton = page.getByRole('button', { name: /^(Start timer|Pause timer)$/i })
  await expect(playButton).toBeVisible({ timeout: 10000 })
  const labelBefore = await playButton.getAttribute('aria-label')
  await page.keyboard.press('Space')
  await expect(playButton).not.toHaveAttribute('aria-label', labelBefore ?? '', { timeout: 5000 })
})
