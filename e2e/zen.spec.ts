import { test, expect } from '@playwright/test'
import { openSettingsTab, settingsSectionNav, waitForAppReady } from './helpers/studyApp'

test('enters focus mode during active timer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /start timer|pause timer/i }).first().click()
  await page.getByRole('button', { name: /focus mode/i }).click()

  await expect(page.getByText(/deep study|resting/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /complete focus/i })).toBeVisible()
})

test('focus lockout blocks exit when enforce lockout is on', async ({ page }) => {
  await waitForAppReady(page)
  await openSettingsTab(page)
  await page.getByRole('button', { name: 'Dismiss backup reminder' }).click({ timeout: 2000 }).catch(() => {})

  await page.getByRole('switch', { name: 'Show advanced settings' }).click()
  await settingsSectionNav(page).getByRole('button', { name: 'Focus', exact: true }).click()

  const zenCard = page.locator('#settings-zen-lockout')
  await expect(zenCard).toBeVisible({ timeout: 10000 })
  const showBtn = zenCard.getByRole('button', { name: 'Show' })
  if (await showBtn.isVisible().catch(() => false)) {
    await showBtn.click()
  }

  const lockoutToggle = page.getByRole('switch', { name: 'Focus lockout' })
  if ((await lockoutToggle.getAttribute('aria-checked')) !== 'true') {
    await lockoutToggle.click()
    await expect(lockoutToggle).toHaveAttribute('aria-checked', 'true')
  }

  await page.getByRole('button', { name: 'Focus' }).first().click()
  await page.getByRole('button', { name: /start timer|pause timer/i }).first().click()
  await page.getByRole('button', { name: /focus mode/i }).click()

  await expect(page.getByText(/deep study/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /exit/i })).toBeVisible()
  await expect(page.getByText('(Locked)')).toBeVisible()
})
