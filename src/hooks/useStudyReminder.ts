import { useEffect, useRef } from 'react'
import { sendFocusBlockCompleteNotification } from '../lib/desktop/focusNotifications'
import { isTauri, sendDesktopNotification } from '../lib/desktop/tauri'

interface UseStudyReminderOptions {
  enabled: boolean
  reminderTime: string
  onlyBelowGoal: boolean
  dailyGoalMinutes: number
  todayStudyMinutes: number
  isDataReady: boolean
}

function parseReminderMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 15 * 60
  return h * 60 + m
}

export function useStudyReminder({
  enabled,
  reminderTime,
  onlyBelowGoal,
  dailyGoalMinutes,
  todayStudyMinutes,
  isDataReady,
}: UseStudyReminderOptions) {
  const firedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || !isDataReady) return

    const check = () => {
      const now = new Date()
      const todayKey = now.toISOString().slice(0, 10)
      if (firedRef.current === todayKey) return

      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const targetMinutes = parseReminderMinutes(reminderTime)
      if (Math.abs(currentMinutes - targetMinutes) > 2) return

      if (onlyBelowGoal && todayStudyMinutes >= dailyGoalMinutes) return

      firedRef.current = todayKey
      const body = `You have ${Math.max(0, dailyGoalMinutes - todayStudyMinutes)} minutes left to hit your daily goal.`
      if (isTauri()) {
        void sendDesktopNotification('Study reminder', body)
      } else {
        sendFocusBlockCompleteNotification('study')
      }
    }

    const id = window.setInterval(check, 60_000)
    const onVisible = () => check()
    document.addEventListener('visibilitychange', onVisible)
    check()
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, reminderTime, onlyBelowGoal, dailyGoalMinutes, todayStudyMinutes, isDataReady])
}
