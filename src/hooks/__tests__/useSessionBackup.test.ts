import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { db } from '../../db/db'
import { resetDatabase, seedTask } from '../../test/dbTestUtils'
import { computeBackupChecksum } from '../../lib/backupChecksum'
import { parseStudyBackupPayload, validateBackupPayload } from '../../lib/studyDashboard'
import { useSessionBackup } from '../useSessionBackup'

interface MockAnchor {
  click: ReturnType<typeof vi.fn>
  download: string
}

describe('useSessionBackup payload helpers', () => {
  it('parses valid backup JSON', () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: [{ text: 'Task', completed: false }],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      flashcards: [],
      quickNotes: [],
    }
    const parsed = parseStudyBackupPayload(JSON.stringify(payload))
    expect(parsed).not.toBeNull()
    expect(parsed?.tasks).toHaveLength(1)
  })

  it('rejects invalid backup shape', () => {
    expect(validateBackupPayload({ tasks: [{ text: 1, completed: false }] })).toBe(false)
  })
})

describe('useSessionBackup hook', () => {
  const pushToast = vi.fn()

  beforeEach(async () => {
    await resetDatabase()
    pushToast.mockClear()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('shows toast on corrupt JSON import', async () => {
    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.importStudyBackup('{ not valid json')
    expect(pushToast).toHaveBeenCalledWith('BACKUP', 'Invalid backup file format')
  })

  it('shows toast on invalid schema import', async () => {
    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.importStudyBackup(JSON.stringify({ version: 2, tasks: 'bad' }))
    expect(pushToast).toHaveBeenCalledWith('BACKUP', 'Backup file failed validation')
  })

  it('exportStudyBackup triggers download with study-vault filename', async () => {
    await seedTask('Export me')
    let capturedAnchor: HTMLAnchorElement | null = null
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag)
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement
        el.click = vi.fn()
      }
      return el
    })

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.exportStudyBackup()

    expect((capturedAnchor as unknown as MockAnchor).click).toHaveBeenCalled()
    expect((capturedAnchor as unknown as MockAnchor).download).toMatch(/^study-vault-\d{4}-\d{2}-\d{2}\.studybackup$/)
    expect(pushToast).toHaveBeenCalledWith('BACKUP', 'Backup exported successfully')
  })

  it('import does not clear tasks when validation fails', async () => {
    await seedTask('Keep me')
    const before = await db.tasks.count()

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.importStudyBackup(JSON.stringify({ version: 2, tasks: 'not-an-array' }))

    const after = await db.tasks.count()
    expect(after).toBe(before)
    expect(pushToast).toHaveBeenCalledWith('BACKUP', 'Backup file failed validation')
  })

  it('createDatabaseSnapshot stores payload in snapshots table', async () => {
    await seedTask('Snapshot task')
    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.createDatabaseSnapshot()

    const count = await db.snapshots.count()
    expect(count).toBe(1)
  })

  it('exportStudyLogsCSV escapes formula-like notes', async () => {
    await db.daily_logs.put({
      dateString: '2026-06-10',
      studyMinutes: 25,
      breakMinutes: 5,
      notes: '=cmd|evil',
    })
    let capturedCsv = ''
    const OriginalBlob = global.Blob
    vi.spyOn(global, 'Blob').mockImplementation(((parts: BlobPart[]) => {
      capturedCsv = String(parts[0])
      return new OriginalBlob(parts)
    }) as unknown as (this: Blob, blobParts?: BlobPart[] | undefined, options?: BlobPropertyBag | undefined) => Blob)
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag)
      if (tag === 'a') el.click = vi.fn()
      return el
    })

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.exportStudyLogsCSV()
    expect(capturedCsv).toContain("'=cmd|evil")
  })

  it('imports valid backup and replaces tasks', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    await seedTask('Old task')
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: [{ text: 'Imported task', completed: false, createdAt: Date.now() }],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      flashcards: [],
      quickNotes: [],
    }

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.importStudyBackup(JSON.stringify(payload))

    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('Imported task')
    expect(reload).toHaveBeenCalled()
  })

  it('exportTaskCompletionLogsCSV produces a download', async () => {
    await seedTask('CSV task')
    let capturedAnchor: HTMLAnchorElement | null = null
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createElement(tag)
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement
        el.click = vi.fn()
      }
      return el
    })

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.exportTaskCompletionLogsCSV()
    expect((capturedAnchor as unknown as MockAnchor).download).toMatch(/^task-logs-/)
  })

  it('rejects import when checksum does not match', async () => {
    await seedTask('Keep on bad checksum')
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      tasks: [{ text: 'Imported task', completed: false, createdAt: Date.now(), estimatedCycles: 1, actualCycles: 0 }],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      flashcards: [],
      quickNotes: [],
    }
    const checksumSha256 = await computeBackupChecksum(payload)
    const tampered = { ...payload, checksumSha256: '0'.repeat(64) }
    void checksumSha256

    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.importStudyBackup(JSON.stringify(tampered))

    expect(pushToast).toHaveBeenCalledWith('BACKUP', 'Backup checksum mismatch — file may be corrupt')
    expect(await db.tasks.toArray()).toHaveLength(1)
    expect((await db.tasks.toArray())[0].text).toBe('Keep on bad checksum')
  })

  it('resetDataSelective clears only chosen tables', async () => {
    await seedTask('Task')
    const { result } = renderHook(() => useSessionBackup(pushToast))
    await result.current.resetDataSelective({ tasks: true, history: false, categories: false, cards: false, notes: false })
    expect(await db.tasks.count()).toBe(0)
    expect(pushToast).toHaveBeenCalledWith('RESET', 'Selected data cleared')
  })
})
