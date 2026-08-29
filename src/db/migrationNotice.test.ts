import { describe, expect, it } from 'vitest'
import { formatMigrationNotice } from './migrationNotice'
import type { MigrationResult } from './studyDb'

describe('formatMigrationNotice', () => {
  it.each<[MigrationResult['status'], MigrationResult]>([
    ['already_migrated', { status: 'already_migrated' }],
    ['no_legacy_data', { status: 'no_legacy_data' }],
    ['demo_data_skipped', { status: 'demo_data_skipped' }],
    ['empty_data_skipped', { status: 'empty_data_skipped' }],
  ])('returns no notice for %s', (_, result) => {
    const notice = formatMigrationNotice(result)
    expect(notice.kind).toBe('none')
    expect(notice.message).toBeNull()
  })

  it('formats success status as a success notice', () => {
    const notice = formatMigrationNotice({ status: 'success', recordCount: 10 })
    expect(notice.kind).toBe('success')
    expect(notice.message).toBe('Legacy study data imported successfully.')
  })

  it('formats invalid_data status as a friendly recoverable error without raw details', () => {
    const notice = formatMigrationNotice({
      status: 'invalid_data',
      reason: 'SyntaxError: Unexpected token in JSON at position 5',
    })
    expect(notice.kind).toBe('error')
    expect(notice.message).toBe(
      'Legacy study data could not be imported due to invalid formatting. Your legacy data remains preserved on this device and can be retried after reloading or correcting the data.'
    )
    expect(notice.message).not.toContain('SyntaxError')
    expect(notice.message).not.toContain('Unexpected token')
  })

  it('formats collision status as a data-protection error without entity or id details', () => {
    const notice = formatMigrationNotice({
      status: 'collision',
      entity: 'tasks',
      id: 'task-999',
    })
    expect(notice.kind).toBe('error')
    expect(notice.message).toBe(
      'Legacy study data migration was stopped to protect existing records from conflicts. No data was changed.'
    )
    expect(notice.message).not.toContain('tasks')
    expect(notice.message).not.toContain('task-999')
  })

  it('formats transaction_failed status as a retry-safe storage error without raw exception text', () => {
    const notice = formatMigrationNotice({
      status: 'transaction_failed',
      error: 'QuotaExceededError: Storage quota exceeded on IndexedDB bulkAdd',
    })
    expect(notice.kind).toBe('error')
    expect(notice.message).toBe(
      'Legacy study data could not be imported due to a storage error. No data was changed, and migration can be retried by reloading the page.'
    )
    expect(notice.message).not.toContain('QuotaExceededError')
    expect(notice.message).not.toContain('IndexedDB')
  })

  it('formats cleanup_failed status as a warning notice after successful migration', () => {
    const notice = formatMigrationNotice({ status: 'cleanup_failed' })
    expect(notice.kind).toBe('warning')
    expect(notice.message).toBe(
      'Legacy study data was imported successfully, but obsolete browser storage could not be removed. Future imports are safely prevented.'
    )
  })
})
