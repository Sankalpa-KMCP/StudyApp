import { describe, it, expect } from 'vitest'
import { computeBackupChecksum, verifyBackupChecksum } from '../backupChecksum'
import type { ParsedStudyBackupPayload, StudyBackupPayload } from '../../study/studyDashboard'

const samplePayloadV4: StudyBackupPayload = {
  version: 4,
  exportedAt: '2026-06-11T00:00:00.000Z',
  tasks: [],
  history: [],
  dailyLogs: [],
  settings: [],
  categories: [],
  quickNotes: [],
}

function asParsed(payload: StudyBackupPayload, extras: Partial<ParsedStudyBackupPayload> = {}): ParsedStudyBackupPayload {
  return { ...payload, rawVersion: payload.version, ...extras }
}

describe('backupChecksum', () => {
  it('computes stable sha256 hex digest for v4 payload', async () => {
    const hash = await computeBackupChecksum(samplePayloadV4)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await computeBackupChecksum(samplePayloadV4)).toBe(hash)
  })

  it('verifies matching checksum and rejects tampered payload', async () => {
    const checksumSha256 = await computeBackupChecksum(samplePayloadV4)
    await expect(verifyBackupChecksum(asParsed({ ...samplePayloadV4, checksumSha256 }))).resolves.toBe(true)
    await expect(verifyBackupChecksum(asParsed({ ...samplePayloadV4, checksumSha256: '0'.repeat(64) }))).resolves.toBe(false)
  })

  it('skips verification when checksum is absent', async () => {
    await expect(verifyBackupChecksum(asParsed(samplePayloadV4))).resolves.toBe(true)
  })

  it('includes legacy flashcards in checksum for v3 imports', async () => {
    const v3Payload = asParsed(
      {
        version: 3,
        exportedAt: '2026-06-11T00:00:00.000Z',
        tasks: [],
        history: [],
        dailyLogs: [],
        settings: [],
        categories: [],
        quickNotes: [],
      },
      { _legacyFlashcards: [{ question: 'Q', answer: 'A' }] },
    )
    const { _legacyFlashcards, checksumSha256: _c, rawVersion: _r, ...base } = v3Payload
    void _c
    void _r
    const checksumSha256 = await computeBackupChecksum({
      ...base,
      flashcards: _legacyFlashcards,
    } as StudyBackupPayload & { flashcards: typeof _legacyFlashcards })
    await expect(verifyBackupChecksum({ ...v3Payload, checksumSha256 })).resolves.toBe(true)
  })

  it('ignores parse-only rawVersion when verifying', async () => {
    const checksumSha256 = await computeBackupChecksum(samplePayloadV4)
    await expect(
      verifyBackupChecksum(asParsed({ ...samplePayloadV4, checksumSha256 }, { rawVersion: 99 })),
    ).resolves.toBe(true)
  })
})
