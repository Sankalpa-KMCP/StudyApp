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

export type StudyGoalRow = {
  id: string
  title: string
  target: number
  progress: number
  period: string
  metric: 'manual' | 'study_time'
  createdAt: string
  updatedAt: string
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

export async function listGoals(page: Page): Promise<StudyGoalRow[]> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })

    try {
      const tx = db.transaction('goals', 'readonly')
      return await new Promise<StudyGoalRow[]>((resolve, reject) => {
        const request = tx.objectStore('goals').getAll()
        request.onsuccess = () => resolve((request.result as StudyGoalRow[]) ?? [])
        request.onerror = () => reject(request.error ?? new Error('Failed to read goals'))
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

export type StudySubjectRow = {
  id: string
  name: string
  color: string
  targetHours: number
  progress: number
  createdAt: string
  updatedAt: string
}

export type StudyExportPayload = {
  version: 1
  exportedAt: string
  tasks: unknown[]
  subjects: StudySubjectRow[]
  notes: unknown[]
  events: unknown[]
  flashcards: unknown[]
  studySessions: StudySessionRow[]
  goals: unknown[]
  settings: Array<{ key: string; value: unknown }>
}

/** Minimal valid Study Dashboard export (version 1) for Settings import tests. */
export function makeStudyExport(overrides: Partial<StudyExportPayload> = {}): StudyExportPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: [],
    subjects: [],
    notes: [],
    events: [],
    flashcards: [],
    studySessions: [],
    goals: [],
    settings: [],
    ...overrides,
  }
}

export function makeSubjectRow(overrides: Partial<StudySubjectRow> & Pick<StudySubjectRow, 'id' | 'name'>): StudySubjectRow {
  const timestamp = '2026-06-29T00:00:00.000Z'
  return {
    color: '#2563eb',
    targetHours: 4,
    progress: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

export async function listSubjects(page: Page): Promise<StudySubjectRow[]> {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })

    try {
      const tx = db.transaction('subjects', 'readonly')
      return await new Promise<StudySubjectRow[]>((resolve, reject) => {
        const request = tx.objectStore('subjects').getAll()
        request.onsuccess = () => resolve((request.result as StudySubjectRow[]) ?? [])
        request.onerror = () => reject(request.error ?? new Error('Failed to read subjects'))
      })
    } finally {
      db.close()
    }
  }, STUDY_DB_NAME)
}

/** Creates a subject through the Subjects workspace and returns its IndexedDB id. */
export async function createSubjectViaUi(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Subjects' }).click()
  await page.getByRole('button', { name: 'New subject' }).click()
  await page.getByLabel('Subject name').fill(name)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 })

  const subjects = await listSubjects(page)
  const match = subjects.find((subject) => subject.name === name)
  if (!match) throw new Error(`Subject not found in IndexedDB after save: ${name}`)
  return match.id
}

/** Imports a valid export JSON through the Settings file input (real app import path). */
export async function importStudyBackupViaSettings(page: Page, payload: StudyExportPayload): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

  const importInput = page.getByLabel('Import data')
  await importInput.setInputFiles({
    name: 'study-dashboard-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  })

  await expect(page.getByRole('status')).toContainText('Study data imported.', { timeout: 15_000 })
}

export type StudyExportDownload = {
  version: number
  goals: StudyGoalRow[]
}

/** Exports study data through Settings and returns the downloaded JSON payload. */
export async function exportStudyBackupViaSettings(page: Page): Promise<StudyExportDownload> {
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise
  const failure = await download.failure()
  if (failure) throw new Error(`Export download failed: ${failure}`)

  const stream = await download.createReadStream()
  if (!stream) throw new Error('Export download stream unavailable')

  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as StudyExportDownload
}

function goalCard(page: Page, title: string) {
  return page.locator('article.detail-card', { has: page.getByRole('heading', { name: title }) })
}

/** Creates a manual goal titled with a legacy keyword and returns after the card is visible. */
export async function createManualGoalViaUi(page: Page, title: string, targetPoints: number, progressPoints: number) {
  await page.getByRole('button', { name: 'Goals' }).click()
  await page.getByRole('button', { name: 'New goal' }).click()
  await page.getByLabel('Goal title').fill(title)
  await page.getByLabel(/Target \(points\)/).fill(String(targetPoints))
  await page.getByLabel('Progress (points)').fill(String(progressPoints))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(goalCard(page, title)).toBeVisible({ timeout: 15_000 })
}

/** Creates a study-time goal without legacy keywords in its title. */
export async function createStudyTimeGoalViaUi(
  page: Page,
  title: string,
  period: 'daily' | 'weekly' | 'monthly',
  target: number,
) {
  await page.getByRole('button', { name: 'Goals' }).click()
  await page.getByRole('button', { name: 'New goal' }).click()
  await page.getByLabel('Goal title').fill(title)
  await page.getByLabel('Metric').selectOption('study_time')
  await page.getByLabel('Period').selectOption(period)
  const unit = period === 'daily' ? 'minutes' : 'hours'
  await page.getByLabel(new RegExp(`Target \\(${unit}\\)`)).fill(String(target))
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(goalCard(page, title)).toBeVisible({ timeout: 15_000 })
}

export { goalCard }
