import { useEffect } from 'react'
import { isTauri, setDesktopTrayTooltip } from '../../lib/desktop/tauri'
import { useStudyTimerControls, useStudyTimerDisplay } from '../../context/studyTimerContext'

/** Isolated leaf that subscribes to timer display ticks for the desktop tray tooltip only. */
export function DesktopTrayTimerBridge() {
  const timerControls = useStudyTimerControls()
  const { remainingSeconds } = useStudyTimerDisplay()

  useEffect(() => {
    if (!isTauri()) return
    const mins = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60
    const time = `${mins}:${secs.toString().padStart(2, '0')}`
    const mode = timerControls.timerMode === 'study' ? 'Focus' : 'Break'
    const state = timerControls.isTimerActive ? 'Running' : 'Paused'
    void setDesktopTrayTooltip(`Study Dashboard — ${mode} ${time} (${state})`)
  }, [
    remainingSeconds,
    timerControls.isTimerActive,
    timerControls.timerMode,
  ])

  return null
}
