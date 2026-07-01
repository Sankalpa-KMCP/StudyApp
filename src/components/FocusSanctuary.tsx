import { useEffect, useMemo, useState } from 'react'
import { MAX_STUDY_BLOCK_MINUTES } from '../lib/shared/timerConstants'
import { Sparkles, Heart, X, Sun } from 'lucide-react'
import { Button } from './shared/Button'
import { PanelCard } from './shared/PanelCard'
import { PanelHeader } from './shared/PanelHeader'
import { SelectionChip } from './shared/SelectionChip'
import { useTranslation } from '../i18n/useTranslation'
import {
  FOCUS_MODE,
  NO_FOCUS_TARGET,
  STUDY_BLOCK_COMPLETE,
  WORKING_ON,
} from '../lib/shared/uxTerms'
import type { TaskItem } from '../db/types'
import { useStudyData } from '../context/useStudyApp'
import { useStudyTimerContext, useStudyTimerDisplay } from '../context/studyTimerContext'
import { TimerDisplay } from './focus/TimerDisplay'
import { TimerControls } from './focus/TimerControls'
import { SessionProgress } from './focus/SessionProgress'

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
    showReflectionModal,
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

  const [showDurationAdjust, setShowDurationAdjust] = useState(false)
  const [breathTime, setBreathTime] = useState(0)
  const [wakeLockChipDismissed, setWakeLockChipDismissed] = useState(false)

  useEffect(() => {
    if (timerMode === 'study') return
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1250)
    return () => clearInterval(interval)
  }, [timerMode])

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

  const currentScale = useMemo(() => {
    return breathTime < 5
      ? 1 + (breathTime / 5) * 0.25
      : breathTime < 7
      ? 1.25
      : 1.25 - ((breathTime - 7) / 5) * 0.25
  }, [breathTime])

  const handleToggleActive = () => {
    onUserGesture?.()
    if (!isTimerActive) onTimerStart?.()
    setIsTimerActive(a => !a)
  }

  return (
    <div className="grid grid-cols-1 gap-6 w-full flex-1 items-start">
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {showReflectionModal && timerMode === 'study' ? STUDY_BLOCK_COMPLETE : ''}
      </div>

      <div className="flex flex-col gap-6 w-full">
        <PanelCard className="flex flex-col">
          <PanelHeader
            title="Focus Timer"
            action={
              <Button size="sm" onClick={() => setIsZenMode(true)} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
                <span>{FOCUS_MODE}</span>
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

          <p className="text-center text-caption text-muted mb-3 select-none">
            {activeTask
              ? `${WORKING_ON}: ${activeTask.text}`
              : NO_FOCUS_TARGET}
          </p>

          <button
            type="button"
            onClick={() => setShowDurationAdjust(v => !v)}
            className="text-micro font-semibold text-accent-blue hover:text-accent-blue/80 mb-2 transition-colors"
          >
            {showDurationAdjust ? t('hideLengthControls') : t('adjustLength')}
          </button>

          <div className={`flex flex-col items-center gap-2 mb-5 border-t border-card pt-4 ${showDurationAdjust ? '' : 'hidden'}`}>
            <span className="panel-title">
              {timerMode === 'study' ? 'Study block length' : isLongBreak ? 'Long break length' : 'Short break length'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={
                  timerMode === 'study'
                    ? studyBlockDurationMinutes <= 5
                    : isLongBreak
                    ? longBreakDurationMinutes <= 5
                    : shortBreakDurationMinutes <= 2
                }
                onClick={() => {
                  const current =
                    timerMode === 'study'
                      ? studyBlockDurationMinutes
                      : isLongBreak
                      ? longBreakDurationMinutes
                      : shortBreakDurationMinutes
                  handleDurationChange(current - (timerMode === 'study' ? 5 : 1))
                }}
                className="h-7 w-7 rounded-full surface-subtle border border-card flex items-center justify-center text-sm text-secondary hover:surface-track active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold select-none"
              >
                -
              </button>
              <span className="text-sm font-mono font-bold text-primary min-w-[60px] text-center">
                {timerMode === 'study'
                  ? studyBlockDurationMinutes
                  : isLongBreak
                  ? longBreakDurationMinutes
                  : shortBreakDurationMinutes} min
              </span>
              <button
                type="button"
                disabled={
                  timerMode === 'study'
                    ? studyBlockDurationMinutes >= MAX_STUDY_BLOCK_MINUTES
                    : isLongBreak
                    ? longBreakDurationMinutes >= 60
                    : shortBreakDurationMinutes >= 30
                }
                onClick={() => {
                  const current =
                    timerMode === 'study'
                      ? studyBlockDurationMinutes
                      : isLongBreak
                      ? longBreakDurationMinutes
                      : shortBreakDurationMinutes
                  handleDurationChange(current + (timerMode === 'study' ? 5 : 1))
                }}
                className="h-7 w-7 rounded-full surface-subtle border border-card flex items-center justify-center text-sm text-secondary hover:surface-track active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold select-none"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
              {(timerMode === 'study' ? [15, 25, 45, 60] : isLongBreak ? [10, 15, 20, 30] : [3, 5, 10, 15]).map(mins => {
                const currentVal =
                  timerMode === 'study'
                    ? studyBlockDurationMinutes
                    : isLongBreak
                    ? longBreakDurationMinutes
                    : shortBreakDurationMinutes
                return (
                  <SelectionChip
                    key={mins}
                    selected={currentVal === mins}
                    accentColor={activeColor}
                    size="sm"
                    onClick={() => handleDurationChange(mins)}
                  >
                    {mins}m
                  </SelectionChip>
                )
              })}
            </div>
          </div>

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
              onToggleActive={handleToggleActive}
              onExtend={timerControls.extendSession}
              onComplete={() => { void timerControls.completeSession() }}
              onSkipBreak={onSkipBreak}
              skipBreak={skipBreak}
            />

            <SessionProgress
              completedSessionsInCycle={completedSessionsInCycle}
              targetSessionsPerCycle={targetSessionsPerCycle}
            />
          </div>

          {timerMode !== 'study' && (
            <div className="mt-4 glass-tier-2 p-3.5 flex flex-col items-center gap-3.5 shadow-md transition-all duration-300 animate-slide-in-up">
              <div className="flex justify-between w-full text-label tracking-wider text-muted uppercase font-bold">
                <span>Respiration Pacer</span>
              </div>

              <div className="flex items-center gap-4.5 w-full justify-center">
                <div className="relative flex h-14 w-14 items-center justify-center shrink-0 select-none">
                  <div
                    className="absolute inset-0 rounded-full bg-accent-purple/5 border border-accent-purple/10 transition-all duration-[1250ms] ease-in-out"
                    style={{
                      transform: `scale(${currentScale * 1.3})`,
                      opacity: breathTime < 5 ? 0.3 : breathTime < 7 ? 0.6 : 0.15,
                    }}
                  />
                  <div
                    className="absolute inset-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/20 transition-all duration-[1250ms] ease-in-out"
                    style={{
                      transform: `scale(${currentScale * 1.15})`,
                      opacity: breathTime < 5 ? 0.45 : breathTime < 7 ? 0.8 : 0.2,
                    }}
                  />
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-purple/20 border border-accent-purple/40 transition-all duration-[1250ms] ease-in-out shadow-[0_0_12px_rgba(175,82,222,0.2)]"
                    style={{ transform: `scale(${currentScale})` }}
                  >
                    <div className="h-3.5 w-3.5 rounded-full bg-accent-purple" />
                  </div>
                </div>

                <div className="flex flex-col select-none max-w-[170px]">
                  <span className="text-xs font-bold tracking-wide text-accent-purple uppercase">
                    {breathTime < 5 ? 'Inhale' : breathTime < 7 ? 'Hold' : 'Exhale'}
                  </span>
                  <span className="text-caption text-muted mt-1 leading-normal font-medium">
                    Slow breathing helps reset focus between blocks.
                  </span>
                </div>
              </div>
            </div>
          )}
        </PanelCard>

        {timerMode === 'study' && (
          <PanelCard className="hidden md:flex select-none flex-col gap-3 !p-4.5">
            <div className="flex items-center justify-between">
              <span className="text-label font-bold tracking-wider text-muted uppercase surface-subtle border border-card px-2 py-0.5 rounded-full">Study tip</span>
              <div className="flex items-center gap-1.5 text-accent-purple">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-label font-bold uppercase tracking-wider">Stay present</span>
              </div>
            </div>
            <div className="glass-tier-2 px-3.5 py-3">
              <p className="text-xs font-bold text-primary">One task at a time</p>
              <p className="text-caption text-muted leading-relaxed mt-1">Pick a single focus target and protect this block from context switches.</p>
            </div>
          </PanelCard>
        )}
      </div>
    </div>
  )
}
