import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const freshVisitStorage = {
  cookies: [],
  origins: [] as Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>,
}

export function settingsSectionNav(page: Page) {
  return page.getByRole('navigation', { name: 'Settings sections' })
}

/** Opens the Settings tab without matching in-page CTAs such as "Enable in Settings". */
export async function openSettingsTab(page: Page): Promise<void> {
  await page.locator('[data-tab="settings"]').filter({ visible: true }).click()
}

/** Opens the Focus tab from the main navigation. */
export async function openFocusTab(page: Page): Promise<void> {
  await page.locator('[data-tab="focus"]').filter({ visible: true }).click()
  await expect(page.getByPlaceholder('What do you want to focus on?').first()).toBeVisible({ timeout: 10000 })
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  const skipOnboarding = page.getByRole('button', { name: 'Skip onboarding tour' })
  if (await skipOnboarding.isVisible().catch(() => false)) {
    await skipOnboarding.click()
  }
}

