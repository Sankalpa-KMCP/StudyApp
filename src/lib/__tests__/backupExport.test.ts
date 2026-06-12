import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resetDatabase, seedTask } from '../../test/dbTestUtils'
import { collectStudyBackupPayload, downloadStudyBackup } from '../backupExport'

interface MockAnchor {
  click: ReturnType<typeof vi.fn>
  download: string
}

describe('backupExport', () => {
  beforeEach(async () => {
    await resetDatabase()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('collectStudyBackupPayload returns version 2 payload with all tables', async () => {
    await seedTask('Backup task')
    const payload = await collectStudyBackupPayload()

    expect(payload.version).toBe(3)
    expect(payload.checksumSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(payload.exportedAt).toBeTruthy()
    expect(payload.tasks).toHaveLength(1)
    expect(Array.isArray(payload.history)).toBe(true)
    expect(Array.isArray(payload.dailyLogs)).toBe(true)
    expect(Array.isArray(payload.settings)).toBe(true)
    expect(Array.isArray(payload.categories)).toBe(true)
    expect(Array.isArray(payload.flashcards)).toBe(true)
    expect(Array.isArray(payload.quickNotes)).toBe(true)
  })

  it('downloadStudyBackup triggers anchor with study-vault filename', () => {
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

    downloadStudyBackup(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: [],
        history: [],
        dailyLogs: [],
        settings: [],
        categories: [],
        flashcards: [],
        quickNotes: [],
      },
      'study-vault',
    )

    expect((capturedAnchor as unknown as MockAnchor).click).toHaveBeenCalled()
    expect((capturedAnchor as unknown as MockAnchor).download).toMatch(/^study-vault-\d{4}-\d{2}-\d{2}\.studybackup$/)
  })

  it('downloadStudyBackup uses emergency prefix when specified', () => {
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

    downloadStudyBackup(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: [],
        history: [],
        dailyLogs: [],
        settings: [],
        categories: [],
        flashcards: [],
        quickNotes: [],
      },
      'study-emergency-export',
    )

    expect((capturedAnchor as unknown as MockAnchor).download).toMatch(/^study-emergency-export-\d{4}-\d{2}-\d{2}\.studybackup$/)
  })
})
