import { useState } from 'react'
import { MAX_STUDY_BLOCK_MINUTES } from '../../lib/shared/timerConstants'
import { SelectionChip } from '../shared/SelectionChip'
import { useTranslation } from '../../i18n/useTranslation'

interface TimerDurationControlsProps {
  timerMode: 'study' | 'break'
  isLongBreak: boolean
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  activeColor: string
  onDurationChange: (minutes: number) => void
}

export function TimerDurationControls({
  timerMode,
  isLongBreak,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  activeColor,
  onDurationChange,
}: TimerDurationControlsProps) {
  const { t } = useTranslation()
  const [showDurationAdjust, setShowDurationAdjust] = useState(false)

  const currentMinutes =
    timerMode === 'study'
      ? studyBlockDurationMinutes
      : isLongBreak
      ? longBreakDurationMinutes
      : shortBreakDurationMinutes

  const presetMinutes =
    timerMode === 'study' ? [15, 25, 45, 60] : isLongBreak ? [10, 15, 20, 30] : [3, 5, 10, 15]

  const step = timerMode === 'study' ? 5 : 1
  const minLimit = timerMode === 'study' ? 5 : isLongBreak ? 5 : 2
  const maxLimit =
    timerMode === 'study'
      ? MAX_STUDY_BLOCK_MINUTES
      : isLongBreak
      ? 60
      : 30

  const lengthLabel =
    timerMode === 'study'
      ? 'Study block length'
      : isLongBreak
      ? 'Long break length'
      : 'Short break length'

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDurationAdjust(v => !v)}
        className="text-label font-semibold text-accent-blue opacity-90 hover:opacity-100 mb-2 transition-opacity"
      >
        {showDurationAdjust ? t('hideLengthControls') : t('adjustLength')}
      </button>

      <div className={`flex flex-col items-center gap-2 mb-5 border-t border-card pt-4 ${showDurationAdjust ? '' : 'hidden'}`}>
        <span className="panel-title">{lengthLabel}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={currentMinutes <= minLimit}
            onClick={() => onDurationChange(currentMinutes - step)}
            className="h-7 w-7 rounded-full surface-subtle border border-card flex items-center justify-center text-sm text-secondary hover:surface-track active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold select-none"
          >
            -
          </button>
          <span className="text-sm font-mono font-bold text-primary min-w-[60px] text-center">
            {currentMinutes} min
          </span>
          <button
            type="button"
            disabled={currentMinutes >= maxLimit}
            onClick={() => onDurationChange(currentMinutes + step)}
            className="h-7 w-7 rounded-full surface-subtle border border-card flex items-center justify-center text-sm text-secondary hover:surface-track active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold select-none"
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
          {presetMinutes.map(mins => (
            <SelectionChip
              key={mins}
              selected={currentMinutes === mins}
              accentColor={activeColor}
              size="sm"
              onClick={() => onDurationChange(mins)}
            >
              {mins}m
            </SelectionChip>
          ))}
        </div>
      </div>
    </>
  )
}
