import { test, expect } from '@playwright/test'

test('error boundary export and reset confirm', async ({ page }) => {
  await page.goto('/?e2e_force_error=1')
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible({ timeout: 15000 })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.studybackup$/)

  await page.getByRole('button', { name: 'Reset database' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reset database?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
})
