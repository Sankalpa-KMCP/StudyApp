import { useState, useCallback } from 'react'
import {
  daysSinceLastExport,
  setLastBackupDismissedAt,
  shouldShowBackupReminder,
} from '../lib/backup/backupMetadata'

const REMINDER_INTERVAL_DAYS = 30
const SNOOZE_DAYS = 7

export function useBackupReminder() {
  const [shouldRemind, setShouldRemind] = useState(() => shouldShowBackupReminder(REMINDER_INTERVAL_DAYS, SNOOZE_DAYS))
  const [daysSinceExport, setDaysSinceExport] = useState<number | null>(() => daysSinceLastExport())

  const refresh = useCallback(() => {
    setShouldRemind(shouldShowBackupReminder(REMINDER_INTERVAL_DAYS, SNOOZE_DAYS))
    setDaysSinceExport(daysSinceLastExport())
  }, [])

  const dismissReminder = () => {
    setLastBackupDismissedAt()
    setShouldRemind(false)
  }

  return { shouldRemind, dismissReminder, daysSinceExport, refresh }
}
