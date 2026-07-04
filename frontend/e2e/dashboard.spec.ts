import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('renders a blank database-backed dashboard and persists tasks', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Good morning' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Weekly Progress' })).toBeVisible()
  await expect(page.getByText('No tasks yet')).toBeVisible()

  await page.getByRole('button', { name: 'Tasks' }).click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Geometry revision')
  await page.getByLabel('Minutes').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Geometry revision')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Tasks' }).click()
  await expect(page.getByText('Geometry revision')).toBeVisible()

  await page.getByPlaceholder('Search').fill('geometry')
  await expect(page.getByText('Geometry revision')).toBeVisible()
  await expect(page.getByText('Chemistry lab report')).toBeHidden()
})

test('creates a note and navigates with linked controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Notes' }).click()
  await expect(page.getByRole('heading', { name: 'Notes' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note title').fill('Sunday study plan')
  await page.getByLabel('Body').fill('Two review blocks and one practice paper.')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Sunday study plan')).toBeVisible()
})

test('opens new task and subject editors from the home hero', async ({ page }) => {
  const hero = page.locator('section[aria-label="Today overview"]')

  await hero.getByRole('button', { name: 'Task' }).click()
  await expect(page.getByRole('heading', { name: 'Tasks' }).first()).toBeVisible()
  await expect(page.getByLabel('Task title')).toBeVisible()

  await page.getByRole('button', { name: 'Home' }).click()
  await hero.getByRole('button', { name: 'Subject' }).click()
  await expect(page.getByRole('heading', { name: 'Subjects' }).first()).toBeVisible()
  await expect(page.getByLabel('Subject name')).toBeVisible()
})

test('creates and reviews a flashcard', async ({ page }) => {
  await page.getByRole('button', { name: 'Flashcards' }).click()
  await page.getByRole('button', { name: 'New card' }).click()
  await page.getByLabel('Front').fill('Photosynthesis')
  await page.getByLabel('Back').fill('Plants convert light into chemical energy.')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Photosynthesis')).toBeVisible()
  await expect(page.getByText('Answer hidden')).toBeVisible()
  await page.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText('Plants convert light into chemical energy.')).toBeVisible()
  await page.getByRole('button', { name: 'Remembered' }).click()
  const card = page.locator('article.flashcard').filter({ hasText: 'Photosynthesis' })
  await expect(card.locator('.status-badge')).toHaveText('remembered')
})

test('keeps the dashboard usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByPlaceholder('Search')).toBeVisible()
  await page.getByRole('button', { name: 'Tasks' }).click()
  await expect(page.getByRole('heading', { name: 'Tasks' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible()
})
