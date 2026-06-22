import { useTranslation } from '../i18n/useTranslation'
import type { TaskItem } from '../db/types'
import { useStudyTimerContext } from '../context/studyTimerContext'
import { FocusTimerSection } from './focus/FocusTimerSection'
import { FocusStudyTipSection } from './focus/FocusTaskSection'

interface FocusSanctuaryProps {
  activeTask?: TaskItem | null
  setIsZenMode: (zen: boolean) => void
  onUserGesture?: () => void
  onSkipBreak?: () => void
  onTimerStart?: () => void
}

export function FocusSanctuary({
  activeTask = null,
  setIsZenMode,
  onUserGesture,
  onSkipBreak,
  onTimerStart,
}: FocusSanctuaryProps) {
  const { t } = useTranslation()
  const { timerControls } = useStudyTimerContext()
  const { showReflectionModal, timerMode } = timerControls

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start">
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {showReflectionModal && timerMode === 'study' ? t('studyBlockComplete') : ''}
      </div>

      <div className="flex flex-col gap-6 w-full">
        <FocusTimerSection
          activeTask={activeTask}
          setIsZenMode={setIsZenMode}
          onUserGesture={onUserGesture}
          onSkipBreak={onSkipBreak}
          onTimerStart={onTimerStart}
        />
        <FocusStudyTipSection />
      </div>
    </div>
  )
}
