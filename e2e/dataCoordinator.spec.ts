import { expect, test } from '@playwright/test'
import { HOME_GREETING_HEADING } from './a11yHelpers'
import { navigateWorkspace } from './navHelpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
})

test('Settings operation coordinator serializes Delete All and Export in one browser task', async ({ page }) => {
  // 1. Seed identifiable study data
  await navigateWorkspace(page, 'Tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Identifiable concurrency task')
  await page.getByLabel('Minutes').fill('30')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Identifiable concurrency task' })).toBeVisible()

  // 2. Navigate to Settings
  await navigateWorkspace(page, 'Settings')

  // 3. Open Delete All confirmation and type DELETE
  await page.getByRole('button', { name: 'Reset all study data' }).click()
  await page.getByPlaceholder('DELETE').fill('DELETE')

  // 4. Register download listener
  let downloadTriggered = false
  page.on('download', () => {
    downloadTriggered = true
  })

  // 5. In one browser JS task, click Delete all data AND Export data immediately
  const deleteBtn = page.getByRole('button', { name: 'Delete all data' })
  const exportBtn = page.getByRole('button', { name: 'Export data' })

  const deleteHandle = await deleteBtn.elementHandle()
  const exportHandle = await exportBtn.elementHandle()

  await page.evaluate(([d, e]) => {
    ;(d as HTMLButtonElement)?.click()
    ;(e as HTMLButtonElement)?.click()
  }, [deleteHandle, exportHandle])

  // 6. Assertions:
  // - Delete All completes successfully and navigates to Home with success notice
  await expect(page.getByRole('status')).toContainText('All study data has been permanently deleted.', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()

  // - Seeded task is deleted
  await navigateWorkspace(page, 'Tasks')
  await expect(page.getByText('Identifiable concurrency task')).toHaveCount(0)

  // - No export download occurred
  expect(downloadTriggered).toBe(false)

  // - Controls become available again after settlement
  await navigateWorkspace(page, 'Settings')
  await expect(page.getByRole('button', { name: 'Export data' })).toBeEnabled()
  await expect(page.getByLabel('Import data')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Reset all study data' })).toBeEnabled()
})
