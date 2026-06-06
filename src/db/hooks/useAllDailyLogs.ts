import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export function useAllDailyLogs() {
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())
  return { allLogs: allLogs ?? [], isLoading: allLogs === undefined }
}
