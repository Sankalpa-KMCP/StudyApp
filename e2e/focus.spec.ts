import { test, expect } from '@playwright/test'

test('loads focus tab and shows study dashboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /start|focus|study/i }).first()).toBeVisible()
})

test('creates subject inline and auto-starts timer when adding focus target', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Focus targets', { exact: true })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: '✏️ Manage' }).click()
  await page.getByPlaceholder('New category label...').fill('Physics E2E')
  await page.locator('.animate-fade-in').getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  const input = page.getByPlaceholder('What do you want to focus on?')
  await input.fill('Read chapter 1')
  await input.press('Enter')

  await expect(page.getByRole('button', { name: 'Task Read chapter 1' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('button', { name: /pause timer/i })).toBeVisible({ timeout: 5000 })
})

test('auto-starts timer when selecting an existing focus target', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Focus targets', { exact: true })).toBeVisible({ timeout: 15000 })

  const input = page.getByPlaceholder('What do you want to focus on?')
  await input.fill('First task')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Task First task' })).toBeVisible({ timeout: 10000 })

  await input.fill('Second task')
  await input.press('Enter')
  await expect(page.getByRole('button', { name: 'Task Second task' })).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /pause timer/i }).click()
  await expect(page.getByRole('button', { name: /start timer/i })).toBeVisible()

  await page.getByRole('button', { name: 'Task First task' }).click()
  await expect(page.getByRole('button', { name: /pause timer/i })).toBeVisible({ timeout: 5000 })
})
