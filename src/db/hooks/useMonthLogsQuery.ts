import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { DailyLog } from '../types'
import { calculateMonthLogs } from '../../lib/studyDashboard'

export function useMonthLogsQuery(month: number, year: number, studyBlockMinutes = 25, enabled = true) {
  const logs = useLiveQuery<DailyLog[] | undefined>(
    () => {
      if (!enabled) return []
      return db.daily_logs
        .where('dateString')
        .between(
          `${year}-${String(month + 1).padStart(2, '0')}-`,
          `${year}-${String(month + 1).padStart(2, '0')}-\uffff`,
        )
        .toArray()
    },
    [month, year, enabled],
  )

  const data = logs
    ? calculateMonthLogs(logs, month, year, studyBlockMinutes)
    : { monthLogs: [], totalMonthHours: 0, totalMonthSessions: 0 }

  return {
    monthLogs: data.monthLogs,
    totalMonthHours: data.totalMonthHours,
    totalMonthSessions: data.totalMonthSessions,
    isLoading: logs === undefined,
  }
}
