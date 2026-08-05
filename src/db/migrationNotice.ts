import type { MigrationResult } from './studyDb'

export type MigrationNoticeDetails = {
  kind: 'none' | 'success' | 'warning' | 'error'
  message: string | null
}

export function formatMigrationNotice(result: MigrationResult): MigrationNoticeDetails {
  switch (result.status) {
    case 'already_migrated':
    case 'no_legacy_data':
    case 'demo_data_skipped':
    case 'empty_data_skipped':
      return { kind: 'none', message: null }
    case 'success':
      return {
        kind: 'success',
        message: 'Legacy study data imported successfully.',
      }
    case 'invalid_data':
      return {
        kind: 'error',
        message: 'Legacy study data could not be imported due to invalid formatting. Your legacy data remains preserved on this device and can be retried after reloading or correcting the data.',
      }
    case 'collision':
      return {
        kind: 'error',
        message: 'Legacy study data migration was stopped to protect existing records from conflicts. No data was changed.',
      }
    case 'transaction_failed':
      return {
        kind: 'error',
        message: 'Legacy study data could not be imported due to a storage error. No data was changed, and migration can be retried by reloading the page.',
      }
    case 'cleanup_failed':
      return {
        kind: 'warning',
        message: 'Legacy study data was imported successfully, but obsolete browser storage could not be removed. Future imports are safely prevented.',
      }
  }
}
