import { test, expect } from '@playwright/test'

test('creates a flashcard in recall deck', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /recall deck|cards/i }).filter({ visible: true }).click()
  await expect(page.getByText('Active Recall Deck')).toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder('Enter front side question...').fill('What is SM-2?')
  await page.getByPlaceholder('Enter back side answer detail...').fill('Spaced repetition algorithm')
  await page.getByRole('button', { name: /add to deck/i }).click()
  await expect(page.getByText('What is SM-2?')).toBeVisible({ timeout: 10000 })
})
