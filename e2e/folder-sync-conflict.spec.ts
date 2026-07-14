import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers/studyApp'
import {
  connectE2eSyncFolder,
  enableFolderSync,
  expectSyncConflictModal,
  getSyncSetting,
  openFolderSyncPanel,
  prepareSyncConflict,
  triggerSyncNow,
} from './helpers/syncE2e'

async function setupConnectedSync(page: import('@playwright/test').Page) {
  await waitForAppReady(page)
  await openFolderSyncPanel(page)
  await connectE2eSyncFolder(page)
  await enableFolderSync(page)
}

test.describe('folder sync conflict resolution', () => {
  test('shows conflict modal when remote and local diverge from baseline', async ({ page }) => {
    await setupConnectedSync(page)
    await prepareSyncConflict(page)

    const taskInput = page.getByPlaceholder('What do you want to focus on?')
    await taskInput.fill('Local divergence task')
    await taskInput.press('Enter')
    await expect(page.getByText('Local divergence task').first()).toBeVisible({ timeout: 10000 })

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)
  })

  test('keep local overwrites remote sync file', async ({ page }) => {
    await setupConnectedSync(page)
    await prepareSyncConflict(page)

    const taskInput = page.getByPlaceholder('What do you want to focus on?')
    await taskInput.fill('Keep local task')
    await taskInput.press('Enter')
    await expect(page.getByText('Keep local task').first()).toBeVisible({ timeout: 10000 })

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)

    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Keep local' }).click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    const written = await page.evaluate(() => window.__studySyncTestAdapterController?.getWrittenContent())
    expect(written).toContain('Keep local task')
    expect(written).not.toContain('Remote-only task')
  })

  test('keep remote replaces local data with remote snapshot', async ({ page }) => {
    await setupConnectedSync(page)
    await prepareSyncConflict(page)

    const taskInput = page.getByPlaceholder('What do you want to focus on?')
    await taskInput.fill('Local task to discard')
    await taskInput.press('Enter')
    await expect(page.getByText('Local task to discard').first()).toBeVisible({ timeout: 10000 })

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)

    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Keep remote' }).click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    await page.getByRole('button', { name: 'Focus' }).first().click()
    await expect(page.getByText('Remote-only task').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Local task to discard', { exact: true })).toHaveCount(0)
  })

  test('merge combines local and remote changes then pushes merged backup', async ({ page }) => {
    await setupConnectedSync(page)
    const { remotePayload } = await prepareSyncConflict(page)

    const taskInput = page.getByPlaceholder('What do you want to focus on?')
    await taskInput.fill('Local merge task')
    await taskInput.press('Enter')
    await expect(page.getByText('Local merge task').first()).toBeVisible({ timeout: 10000 })

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)

    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Merge preview' }).click()
    await dialog.getByRole('button', { name: 'Merge changes' }).click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    await page.getByRole('button', { name: 'Focus' }).first().click()
    await expect(page.getByText('Local merge task').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Remote-only task').first()).toBeVisible({ timeout: 15000 })

    const written = await page.evaluate(() => window.__studySyncTestAdapterController?.getWrittenContent())
    expect(written).toContain('Local merge task')
    expect(written).toContain('Remote-only task')

    const lastChecksum = await getSyncSetting(page, 'lastSyncChecksum')
    expect(lastChecksum).not.toBe(remotePayload.checksumSha256)
  })
})
