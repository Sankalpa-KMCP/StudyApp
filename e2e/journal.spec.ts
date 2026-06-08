import { test, expect } from '@playwright/test'

test('journal tab day detail mood and notes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Journal' }).first().click()
  await expect(
    page.getByText(/loading journal/i).or(page.getByText(/day journal|session timeline/i)).first(),
  ).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/day journal/i).first()).toBeVisible({ timeout: 20000 })

  const today = new Date()
  const monthName = today.toLocaleString('en-US', { month: 'long' })
  const day = today.getDate()
  await page.getByRole('gridcell', { name: new RegExp(`${monthName} ${day},`, 'i') }).click()

  await page.getByRole('group', { name: /track mood/i }).getByRole('button', { name: /focused/i }).click()
  const notes = page.getByPlaceholder(/how did you perform/i)
  await notes.fill('E2E journal note')
  await notes.blur()
  await expect(notes).toHaveValue('E2E journal note')
})
