export const LAST_BACKUP_EXPORT_KEY = 'last_backup_export_at'
export const LAST_BACKUP_DISMISSED_KEY = 'last_backup_dismissed'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function getLastBackupExportAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_EXPORT_KEY)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function setLastBackupExportAt(timestamp = Date.now()): void {
  localStorage.setItem(LAST_BACKUP_EXPORT_KEY, String(timestamp))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('study-backup-exported'))
  }
}

export function getLastBackupDismissedAt(): number | null {
  const raw = localStorage.getItem(LAST_BACKUP_DISMISSED_KEY)
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function setLastBackupDismissedAt(timestamp = Date.now()): void {
  localStorage.setItem(LAST_BACKUP_DISMISSED_KEY, String(timestamp))
}

export function daysSince(timestamp: number): number {
  return (Date.now() - timestamp) / MS_PER_DAY
}

export function shouldShowBackupReminder(
  intervalDays = 30,
  snoozeDays = 7,
): boolean {
  const dismissedAt = getLastBackupDismissedAt()
  if (dismissedAt !== null && daysSince(dismissedAt) < snoozeDays) {
    return false
  }

  const exportAt = getLastBackupExportAt()
  if (exportAt === null) {
    return true
  }

  return daysSince(exportAt) >= intervalDays
}

export function daysSinceLastExport(): number | null {
  const exportAt = getLastBackupExportAt()
  if (exportAt === null) return null
  return Math.floor(daysSince(exportAt))
}
