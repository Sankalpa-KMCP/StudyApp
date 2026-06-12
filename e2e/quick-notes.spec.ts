import { test, expect } from '@playwright/test'

test('quick notes drawer create and list note', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /quick notes/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('button', { name: /create note/i }).first().click()
  await expect(page.locator('input[value="New Scratch Note"]')).toBeVisible({ timeout: 10000 })
})
