import { expect, type Page } from '@playwright/test'

/** Matches ACTIVE_FOCUS_SESSION_KEY / study-dashboard-db in production Dexie schema. */
export const STUDY_DB_NAME = 'study-dashboard-db'
export const ACTIVE_FOCUS_SESSION_KEY = 'activeFocusSession'

export type FocusSessionSeed = {
  id: string
  subjectId: string
  startedAt: string
  plannedMinutes: number
  status: 'running' | 'paused'
  pausedAt: string | null
  accumulatedPausedMs: number
}

export type StudySessionRow = {
  id: string
  subjectId: string
  startedAt: string
  endedAt: string
  minutes: number
  note: string
}

async function openStudyDb(page: Page): Promise<void> {
  // Ensure Dexie has created the real schema before raw IndexedDB reads/writes.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Focus session' }).or(page.getByRole('heading', { name: 'Unfinished focus session' }))).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * Seeds `settings.activeFocusSession` via IndexedDB against the live Dexie schema.
 * Used only when UI cannot create expired/stale timestamps deterministically.
 */
export async function seedActiveFocusSession(page: Page, session: FocusSessionSeed): Promise<void> {
  await openStudyDb(page)
  await page.evaluate(
    async ({ dbName, key, value }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      })

      try {
        const tx = db.transaction('settings', 'readwrite')
        tx.objectStore('settings').put({ key, value })
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error ?? new Error('Failed to write activeFocusSession'))
          tx.onabort = () => reject(tx.error ?? new Error('activeFocusSession write aborted'))
        })
      } finally {
        db.close()
      }
    },
    { dbName: STUDY_DB_NAME, key: ACTIVE_FOCUS_SESSION_KEY, value: session },
  )
}

export async function readActiveFocusSession(page: Page): Promise<FocusSessionSeed | null> {
  return page.evaluate(
    async ({ dbName, key }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      })

      try {
        const tx = db.transaction('settings', 'readonly')
        const record = await new Promise<{ key: string; value: FocusSessionSeed } | undefined>((resolve, reject) => {
          const request = tx.objectStore('settings').get(key)
          request.onsuccess = () => resolve(request.result as { key: string; value: FocusSessionSeed } | undefined)
          request.onerror = () => reject(request.error ?? new Error('Failed to read activeFocusSession'))
        })
        return record?.value ?? null
      } finally {
        db.close()
      }
    },
    { dbName: STUDY_DB_NAME, key: ACTIVE_FOCUS_SESSION_KEY },
  )
}

export async function listStudySessions(page: Page): Promise<StudySessionRow[]> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })

    try {
      const tx = db.transaction('studySessions', 'readonly')
      return await new Promise<StudySessionRow[]>((resolve, reject) => {
        const request = tx.objectStore('studySessions').getAll()
        request.onsuccess = () => resolve((request.result as StudySessionRow[]) ?? [])
        request.onerror = () => reject(request.error ?? new Error('Failed to read studySessions'))
      })
    } finally {
      db.close()
    }
  }, STUDY_DB_NAME)
}

export function focusCard(page: Page) {
  return page.locator('section.focus-card')
}

export function elapsedLabel(page: Page) {
  return focusCard(page).locator('.session-elapsed strong')
}

export async function waitForStartFocusReady(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled({ timeout: 15_000 })
}

export async function startOpenEndedFocus(page: Page) {
  await waitForStartFocusReady(page)
  await page.getByLabel('Session length').selectOption('0')
  await page.getByRole('button', { name: 'Start focus' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
}

/** Wait until the local FocusCard clock has advanced past 00:00. */
export async function waitForMeasurableElapsed(page: Page) {
  await expect(elapsedLabel(page)).not.toHaveText('00:00', { timeout: 5_000 })
}

export function parseElapsedToSeconds(text: string): number {
  const match = /^(\d+):(\d{2})$/.exec(text.trim())
  if (!match) throw new Error(`Unexpected elapsed text: ${text}`)
  return Number(match[1]) * 60 + Number(match[2])
}

export async function waitMs(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}
