import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { DailyLog } from '../types'

export function useAllDailyLogs(enabled = true) {
  const allLogs = useLiveQuery<DailyLog[]>(async () => {
    if (!enabled) return []
    return db.daily_logs.toArray()
  }, [enabled])
  return { allLogs: allLogs ?? [], isLoading: enabled ? allLogs === undefined : false }
}
