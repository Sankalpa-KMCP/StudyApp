import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { buildDateString } from '../../lib/studyDashboard'
import * as dailyLogsRepo from '../repositories/dailyLogs'

export function useTodayLog() {
  const [dateString, setDateString] = useState(() => buildDateString())

  useEffect(() => {
    const interval = setInterval(() => {
      const current = buildDateString()
      if (current !== dateString) {
        setDateString(current)
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [dateString])

  const log = useLiveQuery(() => db.daily_logs.get(dateString).then(r => r ?? null), [dateString])

  return {
    studyMinutes: log?.studyMinutes ?? 0,
    breakMinutes: log?.breakMinutes ?? 0,
    incrementStudy: dailyLogsRepo.incrementStudyMinutes,
    incrementBreak: dailyLogsRepo.incrementBreakMinutes,
    isLoading: log === undefined,
  }
}
