import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SyncAdapter } from '../syncAdapter'
import { pushToSyncFolder } from '../syncPush'
import { pullFromSyncFolder } from '../syncPull'
import {
  getSyncConflict,
  hasActiveSyncConflict,
  resetSyncRuntimeState,
} from '../syncState'

vi.mock('../../../db/repositories/settings', () => ({
  getSetting: vi.fn(),
  updateSetting: vi.fn(),
}))

vi.mock('../../../db/repositories/database', () => ({
  exportAllTables: vi.fn(),
  replaceAllTables: vi.fn(),
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

vi.mock('../../backup/mergePreview', () => ({
  computeMergePreview: vi.fn(),
}))

vi.mock('../../study/studyDashboard', () => ({
  parseStudyBackupPayload: vi.fn(),
  validateBackupPayload: vi.fn(),
  backupPayloadToTables: vi.fn(),
}))

import { getSetting, updateSetting } from '../../../db/repositories/settings'
import { exportAllTables } from '../../../db/repositories/database'
import { collectStudyBackupPayload } from '../../backup/backupExport'
import { mergeStudyBackup } from '../../backup/backupMerge'
import { verifyBackupChecksum } from '../../backup/backupChecksum'
import { computeMergePreview } from '../../backup/mergePreview'
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
  version: 4,
  rawVersion: 4,
  exportedAt: '2026-06-12T12:00:00.000Z',
  checksumSha256: 'abc123',
  tasks: [],
  history: [],
  dailyLogs: [],
  settings: [],
  categories: [],
  quickNotes: [],
}

const localPayload = {
  ...samplePayload,
  checksumSha256: 'local456',
  exportedAt: '2026-06-12T13:00:00.000Z',
}

const mergePreview = {
  tasksAdded: 1,
  tasksUpdated: 0,
  historyToAppend: 2,
  settingsFromRemote: 0,
  dailyLogDeltas: 0,
  categoriesRemapped: 0,
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

  it('overwrites remote when force option is set', async () => {
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(localPayload)
    vi.mocked(getSetting).mockResolvedValue('common')
    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    const pushed = await pushToSyncFolder(adapter, { force: true })

    expect(pushed).toBe(true)
    expect(adapter.writeSyncFile).toHaveBeenCalledOnce()
    expect(updateSetting).toHaveBeenCalledWith('lastSyncChecksum', 'local456')
  })

  it('skips push while conflict is active unless forced', async () => {
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(localPayload)
    vi.mocked(getSetting).mockResolvedValue('common')
    vi.mocked(exportAllTables).mockResolvedValue({
      tasks: [],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })
    vi.mocked(validateBackupPayload).mockReturnValue(true)
    vi.mocked(parseStudyBackupPayload).mockReturnValue(samplePayload)
    vi.mocked(verifyBackupChecksum).mockResolvedValue(true)
    vi.mocked(computeMergePreview).mockReturnValue(mergePreview)

    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    await pullFromSyncFolder(adapter)
    expect(hasActiveSyncConflict()).toBe(true)

    const pushed = await pushToSyncFolder(adapter)
    expect(pushed).toBe(false)
    expect(adapter.writeSyncFile).not.toHaveBeenCalled()
  })
})

describe('syncPull', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSyncRuntimeState()
  })

  it('merges when only remote changed since last sync', async () => {
    vi.mocked(getSetting).mockResolvedValue('common')
    vi.mocked(collectStudyBackupPayload).mockResolvedValue({
      ...samplePayload,
      checksumSha256: 'common',
    })
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
    expect(hasActiveSyncConflict()).toBe(false)
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

  it('detects conflict when both local and remote changed since last sync', async () => {
    vi.mocked(getSetting).mockResolvedValue('common')
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(localPayload)
    vi.mocked(exportAllTables).mockResolvedValue({
      tasks: [],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })
    vi.mocked(validateBackupPayload).mockReturnValue(true)
    vi.mocked(parseStudyBackupPayload).mockReturnValue(samplePayload)
    vi.mocked(verifyBackupChecksum).mockResolvedValue(true)
    vi.mocked(computeMergePreview).mockReturnValue(mergePreview)

    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    const pulled = await pullFromSyncFolder(adapter)

    expect(pulled).toBe(false)
    expect(mergeStudyBackup).not.toHaveBeenCalled()
    expect(hasActiveSyncConflict()).toBe(true)
    expect(getSyncConflict()).toEqual({
      remotePayload: samplePayload,
      localChecksum: 'local456',
      remoteChecksum: 'abc123',
      preview: mergePreview,
    })
  })

  it('skips pull while conflict is active', async () => {
    vi.mocked(getSetting).mockResolvedValue('common')
    vi.mocked(collectStudyBackupPayload).mockResolvedValue(localPayload)
    vi.mocked(exportAllTables).mockResolvedValue({
      tasks: [],
      history: [],
      dailyLogs: [],
      settings: [],
      categories: [],
      quickNotes: [],
    })
    vi.mocked(validateBackupPayload).mockReturnValue(true)
    vi.mocked(parseStudyBackupPayload).mockReturnValue(samplePayload)
    vi.mocked(verifyBackupChecksum).mockResolvedValue(true)
    vi.mocked(computeMergePreview).mockReturnValue(mergePreview)

    const adapter = createMockAdapter({
      readSyncFile: vi.fn().mockResolvedValue(JSON.stringify(samplePayload)),
    })

    await pullFromSyncFolder(adapter)
    vi.clearAllMocks()

    const pulledAgain = await pullFromSyncFolder(adapter)
    expect(pulledAgain).toBe(false)
    expect(mergeStudyBackup).not.toHaveBeenCalled()
  })
})
