import { expect, test, type Page } from '@playwright/test'
import { navigateWorkspace } from './navHelpers'

const STUDY_DB_NAME = 'study-dashboard-db'

async function seedFullDatabase(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  await page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    try {
      const tx = db.transaction(
        ['subjects', 'tasks', 'notes', 'events', 'studySessions', 'goals', 'settings'],
        'readwrite',
      )

      tx.objectStore('subjects').put({
        id: 'subj-e2e-1',
        name: 'E2E Physics',
        color: '#2563eb',
        targetHours: 10,
        progress: 40,
        progressMode: 'manual',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })

      tx.objectStore('tasks').put({
        id: 'task-e2e-1',
        title: 'Solve Physics Problems',
        subjectId: 'subj-e2e-1',
        dueDate: '2026-08-01',
        priority: 'high',
        status: 'open',
        minutes: 45,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })

      tx.objectStore('notes').put({
        id: 'note-e2e-1',
        title: 'Quantum Kinematics',
        body: 'Kinematics notes for physics',
        subjectId: 'subj-e2e-1',
        tags: ['physics', 'mechanics'],
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })

      tx.objectStore('events').put({
        id: 'event-e2e-1',
        title: 'Physics Midterm',
        subjectId: 'subj-e2e-1',
        startAt: '2026-07-15T09:00:00.000Z',
        endAt: '2026-07-15T11:00:00.000Z',
        location: 'Room 101',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })

      tx.objectStore('studySessions').put({
        id: 'session-e2e-1',
        subjectId: 'subj-e2e-1',
        startedAt: '2026-07-01T10:00:00.000Z',
        endedAt: '2026-07-01T11:00:00.000Z',
        minutes: 60,
        note: 'Read chapter 3',
      })

      tx.objectStore('goals').put({
        id: 'goal-e2e-1',
        title: 'Master Physics',
        target: 100,
        progress: 25,
        period: 'monthly',
        metric: 'manual',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      })

      tx.objectStore('settings').put({
        key: 'quickNotes',
        value: ['Review equations', 'Prepare summary'],
      })

      tx.objectStore('settings').put({
        key: 'activeFocusSession',
        value: {
          id: 'focus-e2e-1',
          subjectId: 'subj-e2e-1',
          startedAt: '2026-07-01T12:00:00.000Z',
          plannedMinutes: 25,
          status: 'running',
          pausedAt: null,
          accumulatedPausedMs: 0,
        },
      })

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, STUDY_DB_NAME)
}

test('exports populated study database and validates version-4 structure and exclusions', async ({ page }) => {
  // 1. Seed deterministic records across all 7 IndexedDB tables
  await seedFullDatabase(page)

  // 2. Set recognizable device-local preferences in localStorage
  await page.evaluate(() => {
    localStorage.setItem('study-dashboard-theme', 'aurora')
    localStorage.setItem('study-dashboard-sidebar-collapsed', 'true')
  })

  // 3. Navigate to Settings workspace
  await navigateWorkspace(page, 'Settings')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

  // 4. Register download listener and trigger Export
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  const download = await downloadPromise

  // 5. Verify suggested filename contract
  const suggestedFilename = download.suggestedFilename()
  expect(suggestedFilename).toMatch(/^study-dashboard-\d{4}-\d{2}-\d{2}\.json$/)

  // 6. Read stream as UTF-8 and parse JSON without modification
  const stream = await download.createReadStream()
  expect(stream).not.toBeNull()

  const chunks: Buffer[] = []
  for await (const chunk of stream!) {
    chunks.push(Buffer.from(chunk))
  }
  const jsonString = Buffer.concat(chunks).toString('utf-8')
  const backup = JSON.parse(jsonString)

  // 7. Validate top-level metadata
  expect(backup.version).toBe(4)
  expect(typeof backup.exportedAt).toBe('string')
  expect(isNaN(Date.parse(backup.exportedAt))).toBe(false)

  // 8. Validate exact top-level collections (no unexpected or missing collections)
  const expectedTopLevelKeys = [
    'version',
    'appVersion',
    'exportedAt',
    'subjects',
    'tasks',
    'notes',
    'events',
    'studySessions',
    'goals',
    'settings',
  ].sort()
  expect(Object.keys(backup).sort()).toEqual(expectedTopLevelKeys)

  const collections = ['subjects', 'tasks', 'notes', 'events', 'studySessions', 'goals', 'settings']
  for (const collection of collections) {
    expect(Array.isArray(backup[collection])).toBe(true)
  }

  // 9. Validate representative seeded records across all active tables
  const subject = backup.subjects.find((s: { id: string }) => s.id === 'subj-e2e-1')
  expect(subject).toBeDefined()
  expect(subject).toMatchObject({
    id: 'subj-e2e-1',
    name: 'E2E Physics',
    color: '#2563eb',
    targetHours: 10,
    progress: 40,
    progressMode: 'manual',
  })

  const task = backup.tasks.find((t: { id: string }) => t.id === 'task-e2e-1')
  expect(task).toBeDefined()
  expect(task).toMatchObject({
    id: 'task-e2e-1',
    title: 'Solve Physics Problems',
    subjectId: 'subj-e2e-1',
    priority: 'high',
    status: 'open',
    minutes: 45,
  })

  const note = backup.notes.find((n: { id: string }) => n.id === 'note-e2e-1')
  expect(note).toBeDefined()
  expect(note).toMatchObject({
    id: 'note-e2e-1',
    title: 'Quantum Kinematics',
    subjectId: 'subj-e2e-1',
    tags: ['physics', 'mechanics'],
  })

  const event = backup.events.find((e: { id: string }) => e.id === 'event-e2e-1')
  expect(event).toBeDefined()
  expect(event).toMatchObject({
    id: 'event-e2e-1',
    title: 'Physics Midterm',
    subjectId: 'subj-e2e-1',
    location: 'Room 101',
  })

  const session = backup.studySessions.find((s: { id: string }) => s.id === 'session-e2e-1')
  expect(session).toBeDefined()
  expect(session).toMatchObject({
    id: 'session-e2e-1',
    subjectId: 'subj-e2e-1',
    minutes: 60,
    note: 'Read chapter 3',
  })

  const goal = backup.goals.find((g: { id: string }) => g.id === 'goal-e2e-1')
  expect(goal).toBeDefined()
  expect(goal).toMatchObject({
    id: 'goal-e2e-1',
    title: 'Master Physics',
    target: 100,
    progress: 25,
    period: 'monthly',
    metric: 'manual',
  })

  const quickNotesRow = backup.settings.find((s: { key: string }) => s.key === 'quickNotes')
  expect(quickNotesRow).toBeDefined()
  expect(quickNotesRow.value).toEqual(['Review equations', 'Prepare summary'])

  const activeFocusRow = backup.settings.find((s: { key: string }) => s.key === 'activeFocusSession')
  expect(activeFocusRow).toBeDefined()
  expect(activeFocusRow.value).toMatchObject({
    id: 'focus-e2e-1',
    subjectId: 'subj-e2e-1',
    plannedMinutes: 25,
    status: 'running',
  })

  // 10. Verify valid subject reference resolution across all collections
  const subjectIds = new Set<string>(backup.subjects.map((s: { id: string }) => s.id))
  for (const item of backup.tasks) {
    if (item.subjectId) expect(subjectIds.has(item.subjectId)).toBe(true)
  }
  for (const item of backup.notes) {
    if (item.subjectId) expect(subjectIds.has(item.subjectId)).toBe(true)
  }
  for (const item of backup.events) {
    if (item.subjectId) expect(subjectIds.has(item.subjectId)).toBe(true)
  }
  for (const item of backup.studySessions) {
    if (item.subjectId) expect(subjectIds.has(item.subjectId)).toBe(true)
  }
  if (activeFocusRow?.value?.subjectId) {
    expect(subjectIds.has(activeFocusRow.value.subjectId)).toBe(true)
  }

  // 11. Verify device-local preference exclusions (not present in backup JSON or settings rows)
  expect(backup).not.toHaveProperty('study-dashboard-theme')
  expect(backup).not.toHaveProperty('study-dashboard-sidebar-collapsed')

  const settingsKeys = backup.settings.map((s: { key: string }) => s.key)
  expect(settingsKeys).not.toContain('study-dashboard-theme')
  expect(settingsKeys).not.toContain('study-dashboard-sidebar-collapsed')
  expect(jsonString).not.toContain('aurora')

  // 12. Verify UI controls return to enabled state
  await expect(page.getByRole('button', { name: 'Export data' })).toBeEnabled()
})
