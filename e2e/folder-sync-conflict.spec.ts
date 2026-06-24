import { test, expect } from '@playwright/test'
import { waitForAppReady, openFocusTab } from './helpers/studyApp'
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
  await openFocusTab(page)
}

async function addLocalTask(page: import('@playwright/test').Page, text: string) {
  const taskInput = page.getByPlaceholder('What do you want to focus on?').first()
  await taskInput.fill(text)
  await taskInput.press('Enter')
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10000 })
}

/** Let debounced auto-push finish, then seed remote/baseline divergence for conflict detection. */
async function prepareConflictAfterLocalChange(page: import('@playwright/test').Page) {
  await page.waitForTimeout(2500)
  return prepareSyncConflict(page)
}

test.describe('folder sync conflict resolution', () => {
  test('shows conflict modal when remote and local diverge from baseline', async ({ page }) => {
    await setupConnectedSync(page)
    await addLocalTask(page, 'Local divergence task')
    await prepareConflictAfterLocalChange(page)

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)
  })

  test('keep local overwrites remote sync file', async ({ page }) => {
    await setupConnectedSync(page)
    await addLocalTask(page, 'Keep local task')
    await prepareConflictAfterLocalChange(page)

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
    await addLocalTask(page, 'Local task to discard')
    await prepareConflictAfterLocalChange(page)

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)

    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Keep remote' }).click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    await openFocusTab(page)
    await expect(page.getByText('Remote-only task').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Local task to discard', { exact: true })).toHaveCount(0)
  })

  test('merge combines local and remote changes then pushes merged backup', async ({ page }) => {
    await setupConnectedSync(page)
    await addLocalTask(page, 'Local merge task')
    const { remotePayload } = await prepareConflictAfterLocalChange(page)

    await openFolderSyncPanel(page)
    await triggerSyncNow(page)
    await expectSyncConflictModal(page)

    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Merge preview' }).click()
    await dialog.getByRole('button', { name: 'Merge changes' }).click()
    await expect(dialog).toBeHidden({ timeout: 15000 })

    await openFocusTab(page)
    await expect(page.getByText('Local merge task').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Remote-only task').first()).toBeVisible({ timeout: 15000 })

    const taskTexts = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('StudyDashboardDB')
        request.onerror = () => reject(request.error ?? new Error('db open failed'))
        request.onsuccess = () => resolve(request.result)
      })
      const tasks = await new Promise<Array<{ text: string }>>((resolve, reject) => {
        const tx = db.transaction('tasks', 'readonly')
        const req = tx.objectStore('tasks').getAll()
        req.onsuccess = () => resolve(req.result as Array<{ text: string }>)
        req.onerror = () => reject(req.error ?? new Error('tasks read failed'))
        tx.oncomplete = () => db.close()
      })
      return tasks.map(task => task.text)
    })
    expect(taskTexts).toEqual(expect.arrayContaining(['Local merge task', 'Remote-only task']))

    const lastChecksum = await getSyncSetting(page, 'lastSyncChecksum')
    expect(lastChecksum).not.toBe(remotePayload.checksumSha256)
  })
})
