import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateStreak, calculateXpLevel } from '../lib/study/studyDashboard'
import type { DailyLog } from '../db/types'

interface UseGamificationOptions {
  allLogs: DailyLog[]
  isDataReady: boolean
}

export function useGamification({ allLogs, isDataReady }: UseGamificationOptions) {
  const currentStreak = useMemo(() => calculateStreak(allLogs), [allLogs])
  const xpData = useMemo(() => calculateXpLevel(allLogs), [allLogs])
  const prevLevelRef = useRef<number | null>(null)
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null)

  useEffect(() => {
    if (isDataReady && xpData.level !== undefined) {
      if (prevLevelRef.current === null) {
        prevLevelRef.current = xpData.level
      } else if (xpData.level > prevLevelRef.current) {
        setPendingLevelUp(xpData.level)
        prevLevelRef.current = xpData.level
      }
    }
  }, [xpData.level, isDataReady])

  const dismissLevelUp = () => setPendingLevelUp(null)

  return { currentStreak, xpData, pendingLevelUp, dismissLevelUp }
}
