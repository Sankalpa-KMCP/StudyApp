import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const freshVisitStorage = {
  cookies: [],
  origins: [] as Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>,
}

const DB_NAME = 'StudyDashboardDB'

export async function clearStudyDatabase(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(async (dbName: string) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'))
      req.onblocked = () => resolve()
    })
  }, DB_NAME)
  await page.reload()
}

export function settingsSectionNav(page: Page) {
  return page.getByRole('navigation', { name: 'Settings sections' })
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  const skipOnboarding = page.getByRole('button', { name: 'Skip onboarding tour' })
  if (await skipOnboarding.isVisible().catch(() => false)) {
    await skipOnboarding.click()
  }
}

export async function enableFlashcards(page: Page): Promise<void> {
  await page.getByRole('button', { name: /control deck|settings/i }).filter({ visible: true }).click()
  await settingsSectionNav(page).getByRole('button', { name: 'Study', exact: true }).click()
  const toggle = page.getByRole('switch', { name: 'Enable flashcards' })
  await expect(toggle).toBeVisible({ timeout: 10000 })
  if ((await toggle.getAttribute('aria-checked')) === 'false') {
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  }
}
