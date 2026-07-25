import { expect, test } from '@playwright/test'

test('deep-links a workspace and restores views with Back/Forward', async ({ page }) => {
  await page.goto('/tasks')

  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByLabel('Task title')).toHaveCount(0)

  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)

  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  await expect(page).toHaveURL(/\/tasks$/)

  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByLabel('Note title')).toHaveCount(0)
})
