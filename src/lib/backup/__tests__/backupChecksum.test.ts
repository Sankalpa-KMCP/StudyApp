import { describe, it, expect } from 'vitest'
import { computeBackupChecksum, verifyBackupChecksum } from '../backupChecksum'
import type { StudyBackupPayload } from '../../study/studyDashboard'

const samplePayload: StudyBackupPayload = {
  version: 3,
  exportedAt: '2026-06-11T00:00:00.000Z',
  tasks: [],
  history: [],
  dailyLogs: [],
  settings: [],
  categories: [],
  flashcards: [],
  quickNotes: [],
}

describe('backupChecksum', () => {
  it('computes stable sha256 hex digest', async () => {
    const hash = await computeBackupChecksum(samplePayload)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(await computeBackupChecksum(samplePayload)).toBe(hash)
  })

  it('verifies matching checksum and rejects tampered payload', async () => {
    const checksumSha256 = await computeBackupChecksum(samplePayload)
    await expect(verifyBackupChecksum({ ...samplePayload, checksumSha256 })).resolves.toBe(true)
    await expect(verifyBackupChecksum({ ...samplePayload, checksumSha256: '0'.repeat(64) })).resolves.toBe(false)
  })

  it('skips verification when checksum is absent', async () => {
    await expect(verifyBackupChecksum(samplePayload)).resolves.toBe(true)
  })

  it('ignores parse-only rawVersion when verifying', async () => {
    const checksumSha256 = await computeBackupChecksum(samplePayload)
    await expect(
      verifyBackupChecksum({ ...samplePayload, checksumSha256, rawVersion: 3 } as StudyBackupPayload & { rawVersion: number }),
    ).resolves.toBe(true)
  })
})
