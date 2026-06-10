import type { TaskItem } from '../db/types'
import { useStudyTimerControls, useStudyTimerDisplay } from '../context/studyTimerContext'
import { ZenOverlay } from './ZenOverlay'

interface ZenOverlayContainerProps {
  isZenMode: boolean
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  sessionTasks: TaskItem[]
  activeTaskId: number | null
  enforceLockout: boolean
  setIsZenMode: (zen: boolean) => void
  pageGradient: string
}

export function ZenOverlayContainer({
  isZenMode,
  canvasRef,
  sessionTasks,
  activeTaskId,
  enforceLockout,
  setIsZenMode,
  pageGradient,
}: ZenOverlayContainerProps) {
  const timer = useStudyTimerControls()
  const { remainingSeconds } = useStudyTimerDisplay()

  return (
    <ZenOverlay
      isZenMode={isZenMode}
      canvasRef={canvasRef}
      remainingSeconds={remainingSeconds}
      timerMode={timer.timerMode}
      sessionTasks={sessionTasks}
      activeTaskId={activeTaskId}
      isTimerActive={timer.isTimerActive}
      setIsTimerActive={timer.setIsTimerActive}
      completeSession={timer.completeSession}
      enforceLockout={enforceLockout}
      setIsZenMode={setIsZenMode}
      pageGradient={pageGradient}
    />
  )
}
