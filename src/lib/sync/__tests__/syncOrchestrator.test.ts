import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SyncAdapter } from '../syncAdapter'
import { pushToSyncFolder } from '../syncPush'
import { pullFromSyncFolder } from '../syncPull'
import { resetSyncRuntimeState } from '../syncState'

vi.mock('../../../db/repositories/settings', () => ({
  getSetting: vi.fn(),
  updateSetting: vi.fn(),
}))

vi.mock('../../backup/backupExport', () => ({
  collectStudyBackupPayload: vi.fn(),
}))

vi.mock('../../backup/backupMerge', () => ({
  mergeStudyBackup: vi.fn(),
}))

vi.mock('../../backup/backupChecksum', () => ({
  verifyBackupChecksum: vi.fn(),
}))

vi.mock('../../study/studyDashboard', () => ({
  parseStudyBackupPayload: vi.fn(),
  validateBackupPayload: vi.fn(),
}))

import { getSetting, updateSetting } from '../../../db/repositories/settings'
import { collectStudyBackupPayload } from '../../backup/backupExport'
import { mergeStudyBackup } from '../../backup/backupMerge'
import { verifyBackupChecksum } from '../../backup/backupChecksum'
import { parseStudyBackupPayload, validateBackupPayload } from '../../study/studyDashboard'

function createMockAdapter(overrides: Partial<SyncAdapter> = {}): SyncAdapter {
  return {
    isConnected: vi.fn().mockResolvedValue(true),
    readSyncFile: vi.fn().mockResolvedValue(null),
    writeSyncFile: vi.fn().mockResolvedValue(undefined),
    getSyncFileMetadata: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

const samplePayload = {
  version: 3,
  rawVersion: 3,
  exportedAt: '2026-06-12T12:00:00.000Z',
  checksumSha256: 'abc123',
  tasks: [],
  history: [],
  dailyLogs: [],
  settings: [],
  categories: [],
  flashcards: [],
  quickNotes: [],
}

describe('syncPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSyncRuntimeState()
  })

  it('skips push when checksum matches stored and remote values', async () => {
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(samplePayload)
    vi.mocked(getSetting).mockResolvedValue('abc123')
    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    const pushed = await pushToSyncFolder(adapter)

    expect(pushed).toBe(false)
    expect(adapter.writeSyncFile).not.toHaveBeenCalled()
  })

  it('writes sync file when remote checksum differs', async () => {
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(samplePayload)
    vi.mocked(getSetting).mockResolvedValue('')
    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify({ ...samplePayload, checksumSha256: 'old' })),
    })

    const pushed = await pushToSyncFolder(adapter)

    expect(pushed).toBe(true)
    expect(adapter.writeSyncFile).toHaveBeenCalledOnce()
    expect(updateSetting).toHaveBeenCalledWith('lastSyncChecksum', 'abc123')
  })
})

describe('syncPull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSyncRuntimeState()
  })

  it('merges when remote checksum differs from stored checksum', async () => {
    vi.mocked(getSetting).mockResolvedValue('old')
    vi.mocked(validateBackupPayload).mockReturnValue(true)
    vi.mocked(parseStudyBackupPayload).mockReturnValue(samplePayload)
    vi.mocked(verifyBackupChecksum).mockResolvedValue(true)
    vi.mocked(mergeStudyBackup).mockResolvedValue(undefined)

    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    const pulled = await pullFromSyncFolder(adapter)

    expect(pulled).toBe(true)
    expect(mergeStudyBackup).toHaveBeenCalledWith(samplePayload)
    expect(updateSetting).toHaveBeenCalledWith('lastSyncChecksum', 'abc123')
  })

  it('skips pull when checksum matches stored checksum', async () => {
    vi.mocked(getSetting).mockResolvedValue('abc123')
    vi.mocked(validateBackupPayload).mockReturnValue(true)
    vi.mocked(parseStudyBackupPayload).mockReturnValue(samplePayload)

    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    const pulled = await pullFromSyncFolder(adapter)

    expect(pulled).toBe(false)
    expect(mergeStudyBackup).not.toHaveBeenCalled()
  })
})
