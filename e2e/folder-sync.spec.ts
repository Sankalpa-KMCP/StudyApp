import { test, expect } from '@playwright/test'
import { waitForAppReady } from './helpers/studyApp'
import {
  connectE2eSyncFolder,
  enableFolderSync,
  openFolderSyncPanel,
} from './helpers/syncE2e'

test.describe('folder sync panel', () => {
  test('persists enable folder sync toggle across reload', async ({ page }) => {
    await waitForAppReady(page)
    await openFolderSyncPanel(page)
    await enableFolderSync(page)

    await page.reload()
    await expect(page.getByText('Study Dashboard').first()).toBeVisible({ timeout: 15000 })
    await openFolderSyncPanel(page)

    await expect(page.getByRole('switch', { name: 'Enable folder sync' })).toBeChecked()
  })

  test('shows unsupported browser banner when File System Access is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, 'showDirectoryPicker')
    })

    await waitForAppReady(page)
    await openFolderSyncPanel(page)

    await expect(page.getByText(/folder sync in the browser requires chrome or edge over https/i)).toBeVisible()
  })

  test('connects e2e sync folder through test adapter', async ({ page }) => {
    await waitForAppReady(page)
    await openFolderSyncPanel(page)
    await connectE2eSyncFolder(page)
    await enableFolderSync(page)

    await expect(page.getByText(/status:/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sync now' })).toBeVisible()
  })
})
