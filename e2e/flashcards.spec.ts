import { test, expect } from '@playwright/test'
import { enableFlashcards, waitForAppReady } from './helpers/studyApp'

test.beforeEach(async ({ page }) => {
  await waitForAppReady(page)
  await enableFlashcards(page)
})

test('creates a flashcard in recall deck', async ({ page }) => {
  await page.getByRole('button', { name: /recall deck|cards/i }).filter({ visible: true }).click()
  await expect(page.getByText('Create new flashcard')).toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder('Enter front side question...').fill('What is SM-2?')
  await page.getByPlaceholder('Enter back side answer detail...').fill('Spaced repetition algorithm')
  await page.getByRole('button', { name: /add to deck/i }).click()
  await expect(page.locator('p').filter({ hasText: 'What is SM-2?' })).toBeVisible({ timeout: 10000 })
})

test('imports tab-separated txt flashcards', async ({ page }) => {
  await page.getByRole('button', { name: /recall deck|cards/i }).filter({ visible: true }).click()
  const tsv = 'Capital of France\tParis\tGeography'
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: 'deck.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(tsv),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Import' }).click()
  await expect(page.locator('p').filter({ hasText: 'Capital of France' })).toBeVisible({ timeout: 10000 })
})
