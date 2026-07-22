import { useId, useMemo, useState } from 'react'
import { Sparkles, Sun, X } from 'lucide-react'
import { Button } from '../shared/Button'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { SelectionChip } from '../shared/SelectionChip'
import { useTranslation } from '../../i18n/useTranslation'
import type { TaskItem } from '../../db/types'
import { useStudyData } from '../../context/useStudyApp'
import { useStudyTimerContext, useStudyTimerDisplay } from '../../context/studyTimerContext'
import { TimerDisplay } from './TimerDisplay'
import { TimerControls } from './TimerControls'
import { FocusActiveTaskLabel } from './FocusTaskSection'
import { TimerDurationControls } from './TimerDurationControls'
import { BreakBreathingPacer } from './BreakBreathingPacer'

interface FocusTimerSectionProps {
  activeTask?: TaskItem | null
  setIsZenMode: (zen: boolean) => void
  onUserGesture?: () => void
  onSkipBreak?: () => void
  onTimerStart?: () => void
}

export function FocusTimerSection({
  activeTask = null,
  setIsZenMode,
  onUserGesture,
  onSkipBreak,
  onTimerStart,
}: FocusTimerSectionProps) {
  const { t } = useTranslation()
  const timerSectionHeadingId = useId()
  const { settings } = useStudyData()
  const { timerControls } = useStudyTimerContext()
  const timerDisplay = useStudyTimerDisplay()

  const {
    timerMode,
    isTimerActive,
    setIsTimerActive,
    isLongBreak,
    completedSessionsInCycle,
    handleModeSwitch,
    skipBreak,
    wakeLockActive,
  } = timerControls

  const {
    remainingSeconds,
    secondsElapsed,
    progress,
  } = timerDisplay

  const {
    studyBlockDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    targetSessionsPerCycle,
    updateSetting,
  } = settings

  const [wakeLockChipDismissed, setWakeLockChipDismissed] = useState(false)

  const handleDurationChange = (newMinutes: number) => {
    if (timerMode === 'study') {
      void updateSetting('studyBlockDurationMinutes', newMinutes)
    } else if (isLongBreak) {
      void updateSetting('longBreakDurationMinutes', newMinutes)
    } else {
      void updateSetting('shortBreakDurationMinutes', newMinutes)
    }
  }

  const activeColor = useMemo(() => {
    if (timerMode === 'study') return 'var(--color-accent-blue)'
    if (isLongBreak) return 'var(--color-accent-green)'
    return 'var(--color-accent-amber)'
  }, [timerMode, isLongBreak])

  const handleToggleActive = () => {
    onUserGesture?.()
    if (!isTimerActive) onTimerStart?.()
    setIsTimerActive(a => !a)
  }

  return (
    <PanelCard className="flex w-full flex-col" role="region" aria-labelledby={timerSectionHeadingId}>
      <PanelHeader
        id={timerSectionHeadingId}
        title={t('focusTimerTitle')}
        bordered={false}
        action={
          <Button size="sm" onClick={() => setIsZenMode(true)} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
            <span>{t('focusMode')}</span>
          </Button>
        }
      />

      {timerMode === 'study' && isTimerActive && wakeLockActive && !wakeLockChipDismissed && (
        <div className="flex items-center justify-between gap-2 mb-3 rounded-full border border-accent-amber/20 bg-accent-amber/10 px-3 py-1.5 text-micro font-semibold text-accent-amber">
          <span className="inline-flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('screenStaysAwake')}
          </span>
          <button
            type="button"
            onClick={() => setWakeLockChipDismissed(true)}
            aria-label={t('dismissWakeLock')}
            className="rounded-full p-0.5 hover:bg-accent-amber/20 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex justify-center gap-2 mb-4">
        {(['study', 'break'] as const).map(mode => {
          const breakAccent = isLongBreak ? 'green' : 'amber'
          return (
            <SelectionChip
              key={mode}
              selected={timerMode === mode}
              accent={mode === 'study' ? 'blue' : breakAccent}
              size="md"
              onClick={() => handleModeSwitch(mode)}
            >
              {mode === 'study' ? t('studyTab') : t('breakTab')}
            </SelectionChip>
          )
        })}
      </div>

      <FocusActiveTaskLabel activeTask={activeTask} />

      <TimerDurationControls
        timerMode={timerMode}
        isLongBreak={isLongBreak}
        studyBlockDurationMinutes={studyBlockDurationMinutes}
        shortBreakDurationMinutes={shortBreakDurationMinutes}
        longBreakDurationMinutes={longBreakDurationMinutes}
        activeColor={activeColor}
        onDurationChange={handleDurationChange}
      />

      <div className="flex flex-col items-center py-2">
        <TimerDisplay
          remainingSeconds={remainingSeconds}
          progress={progress}
          timerMode={timerMode}
          isLongBreak={isLongBreak}
          isTimerActive={isTimerActive}
          activeColor={activeColor}
        />

        <TimerControls
          timerMode={timerMode}
          isTimerActive={isTimerActive}
          secondsElapsed={secondsElapsed}
          activeColor={activeColor}
          completedSessionsInCycle={completedSessionsInCycle}
          targetSessionsPerCycle={targetSessionsPerCycle}
          onToggleActive={handleToggleActive}
          onExtend={timerControls.extendSession}
          onComplete={() => { void timerControls.completeSession() }}
          onSkipBreak={onSkipBreak}
          skipBreak={skipBreak}
        />
      </div>

      {timerMode !== 'study' && <BreakBreathingPacer />}
    </PanelCard>
  )
}
