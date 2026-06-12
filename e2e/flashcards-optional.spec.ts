import { test, expect } from '@playwright/test'
import { clearStudyDatabase, freshVisitStorage, openSettingsTab, settingsSectionNav, waitForAppReady } from './helpers/studyApp'

test.use({ storageState: freshVisitStorage })

test.beforeEach(async ({ page }) => {
  await clearStudyDatabase(page)
})

test('flashcards tab hidden by default and toggleable in settings', async ({ page }) => {
  await waitForAppReady(page)

  const workspaceNav = page.getByRole('navigation').first()
  const cardsNavButton = workspaceNav.getByRole('button', { name: 'Cards', exact: true })
  await expect(cardsNavButton).not.toBeVisible()

  await page.goto('/#cards')
  await expect(page).toHaveURL(/#focus/)

  await openSettingsTab(page)
  await settingsSectionNav(page).getByRole('button', { name: 'Study', exact: true }).click()

  const toggle = page.getByRole('switch', { name: 'Enable flashcards' })
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')

  await expect(cardsNavButton).toBeVisible()

  await cardsNavButton.click()
  await expect(page.getByText('Create new flashcard')).toBeVisible()

  await openSettingsTab(page)
  await settingsSectionNav(page).getByRole('button', { name: 'Study', exact: true }).click()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await expect(cardsNavButton).not.toBeVisible()
})
