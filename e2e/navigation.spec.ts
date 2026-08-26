import { expect, test } from '@playwright/test'

test('deep-links a workspace, syncs document titles, and manages heading focus on navigation and Back/Forward', async ({ page }) => {
  await page.goto('/tasks')

  const tasksHeading = page.getByRole('heading', { level: 1, name: 'Tasks' })
  await expect(tasksHeading).toBeVisible()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page).toHaveTitle('Tasks — Study Dashboard')
  // On deep-link initial load, focus is not forcibly stolen to the heading
  await expect(tasksHeading).not.toBeFocused()
  await expect(page.getByLabel('Task title')).toHaveCount(0)

  // Navigate to Notes via sidebar button
  await page.getByRole('button', { name: 'Notes' }).click()
  const notesHeading = page.getByRole('heading', { level: 1, name: 'Notes' })
  await expect(notesHeading).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page).toHaveTitle('Notes — Study Dashboard')
  await expect(notesHeading).toBeFocused()

  // Browser Back
  await page.goBack()
  await expect(tasksHeading).toBeVisible()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page).toHaveTitle('Tasks — Study Dashboard')
  await expect(tasksHeading).toBeFocused()

  // Browser Forward
  await page.goForward()
  await expect(notesHeading).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page).toHaveTitle('Notes — Study Dashboard')
  await expect(notesHeading).toBeFocused()

  // Navigate to Home
  await page.getByRole('button', { name: 'Home' }).click()
  const homeHeading = page.getByRole('heading', { level: 1 })
  await expect(homeHeading).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  await expect(page).toHaveTitle('Study Dashboard')
  await expect(homeHeading).toBeFocused()

  // Reload on Notes
  await page.goto('/notes')
  await expect(notesHeading).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page).toHaveTitle('Notes — Study Dashboard')
  await expect(page.getByLabel('Note title')).toHaveCount(0)
})
