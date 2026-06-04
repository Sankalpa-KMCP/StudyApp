import { useEffect, useMemo, useRef } from 'react'
import { calculateStreak, calculateXpLevel } from '../lib/studyDashboard'
import type { DailyLog } from '../db/types'

interface UseGamificationOptions {
  allLogs: DailyLog[]
  isDataReady: boolean
  pushToast: (key: string, message: string) => void
}

export function useGamification({ allLogs, isDataReady, pushToast }: UseGamificationOptions) {
  const currentStreak = useMemo(() => calculateStreak(allLogs), [allLogs])
  const xpData = useMemo(() => calculateXpLevel(allLogs), [allLogs])
  const prevLevelRef = useRef<number | null>(null)

  useEffect(() => {
    if (isDataReady && xpData.level !== undefined) {
      if (prevLevelRef.current === null) {
        prevLevelRef.current = xpData.level
      } else if (xpData.level > prevLevelRef.current) {
        pushToast('LEVEL UP', `Reached Level ${xpData.level}! Keep up the focus!`)
        prevLevelRef.current = xpData.level
      }
    }
  }, [xpData.level, isDataReady, pushToast])

  return { currentStreak, xpData }
}
