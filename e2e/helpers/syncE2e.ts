import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { openSettingsTab } from './studyApp'

export const E2E_SYNC_FOLDER_NAME = 'e2e-sync-folder'

export async function openFolderSyncPanel(page: Page): Promise<void> {
  await openSettingsTab(page)
  await page.getByRole('button', { name: 'Data', exact: true }).click()
  await page.getByRole('button', { name: 'Folder sync (web + desktop)' }).click()
}

export async function connectE2eSyncFolder(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choose sync folder' }).click()
  await expect(page.getByText(E2E_SYNC_FOLDER_NAME)).toBeVisible({ timeout: 10000 })
}

export async function enableFolderSync(page: Page): Promise<void> {
  const toggle = page.getByRole('switch', { name: 'Enable folder sync' })
  if (!(await toggle.isChecked())) {
    await toggle.click()
  }
  await expect(toggle).toBeChecked()
}

type BackupPayloadInput = {
  exportedAt?: string
  tasks?: Array<Record<string, unknown>>
  settings?: Array<{ key: string; value: unknown }>
}

export async function buildSignedBackupPayload(page: Page, input: BackupPayloadInput = {}) {
  return page.evaluate(async payloadInput => {
    const base = {
      version: 4,
      exportedAt: payloadInput.exportedAt ?? '2026-06-12T12:00:00.000Z',
      tasks: payloadInput.tasks ?? [],
      history: [],
      dailyLogs: [],
      settings: payloadInput.settings ?? [],
      categories: [],
      quickNotes: [],
    }
    const canonical = JSON.stringify(base)
    const bytes = new TextEncoder().encode(canonical)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const checksumSha256 = Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
    return { ...base, checksumSha256 }
  }, input)
}

export async function setRemoteSyncPayload(page: Page, payload: Record<string, unknown>): Promise<void> {
  const content = JSON.stringify(payload, null, 2)
  await page.evaluate(async remoteContent => {
    window.__studySyncTestAdapterController?.setContent(remoteContent)
  }, content)
}

export async function setSyncSetting(
  page: Page,
  key: string,
  value: string | boolean | number,
): Promise<void> {
  await page.evaluate(async ({ settingKey, settingValue }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('StudyDashboardDB')
      request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('settings', 'readwrite')
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('settings write failed'))
        tx.objectStore('settings').put({ key: settingKey, value: settingValue })
      }
    })
  }, { settingKey: key, settingValue: value })
}

export async function getSyncSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(async settingKey => {
    return new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open('StudyDashboardDB')
      request.onerror = () => reject(request.error ?? new Error('indexedDB open failed'))
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('settings', 'readonly')
        const getReq = tx.objectStore('settings').get(settingKey)
        getReq.onsuccess = () => {
          db.close()
          resolve(getReq.result?.value)
        }
        getReq.onerror = () => reject(getReq.error ?? new Error('settings read failed'))
      }
    })
  }, key)
}

export async function resetE2eSyncAdapter(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__studySyncTestAdapterController?.reset()
  })
}

export async function triggerSyncNow(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sync now' }).click()
}

export async function prepareSyncConflict(page: Page): Promise<{
  baselineChecksum: string
  remotePayload: Record<string, unknown>
}> {
  const baselineChecksum = 'e2e-sync-baseline-checksum'
  const remotePayload = await buildSignedBackupPayload(page, {
    exportedAt: '2026-06-12T10:00:00.000Z',
    tasks: [{
      id: 1,
      text: 'Remote-only task',
      completed: false,
      createdAt: 1,
      estimatedCycles: 1,
      actualCycles: 0,
    }],
  })

  await setSyncSetting(page, 'lastSyncChecksum', baselineChecksum)
  await setRemoteSyncPayload(page, remotePayload)

  return { baselineChecksum, remotePayload }
}

export async function expectSyncConflictModal(page: Page): Promise<void> {
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('heading', { name: 'Sync conflict' })).toBeVisible({ timeout: 15000 })
  await expect(dialog.getByText(/both this device and the sync folder changed/i)).toBeVisible()
}
