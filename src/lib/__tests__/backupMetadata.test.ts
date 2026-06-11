import { afterEach, describe, expect, it } from 'vitest'
import {
  LAST_BACKUP_DISMISSED_KEY,
  LAST_BACKUP_EXPORT_KEY,
  daysSinceLastExport,
  setLastBackupDismissedAt,
  setLastBackupExportAt,
  shouldShowBackupReminder,
} from '../backupMetadata'

afterEach(() => {
  localStorage.clear()
})

describe('backupMetadata', () => {
  it('shows reminder when never exported', () => {
    expect(shouldShowBackupReminder()).toBe(true)
  })

  it('hides reminder after recent export', () => {
    setLastBackupExportAt(Date.now())
    expect(shouldShowBackupReminder()).toBe(false)
  })

  it('shows reminder when export is older than interval', () => {
    setLastBackupExportAt(Date.now() - 31 * 24 * 60 * 60 * 1000)
    expect(shouldShowBackupReminder(30, 7)).toBe(true)
  })

  it('snoozes reminder for snoozeDays after dismiss', () => {
    setLastBackupExportAt(Date.now() - 31 * 24 * 60 * 60 * 1000)
    setLastBackupDismissedAt(Date.now())
    expect(shouldShowBackupReminder(30, 7)).toBe(false)
  })

  it('shows reminder after snooze expires', () => {
    setLastBackupExportAt(Date.now() - 31 * 24 * 60 * 60 * 1000)
    setLastBackupDismissedAt(Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(shouldShowBackupReminder(30, 7)).toBe(true)
  })

  it('tracks days since last export', () => {
    expect(daysSinceLastExport()).toBeNull()
    setLastBackupExportAt(Date.now() - 5 * 24 * 60 * 60 * 1000)
    expect(daysSinceLastExport()).toBe(5)
  })

  it('uses expected localStorage keys', () => {
    setLastBackupExportAt(123)
    setLastBackupDismissedAt(456)
    expect(localStorage.getItem(LAST_BACKUP_EXPORT_KEY)).toBe('123')
    expect(localStorage.getItem(LAST_BACKUP_DISMISSED_KEY)).toBe('456')
  })
})
