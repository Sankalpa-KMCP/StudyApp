import { Clock } from 'lucide-react'
import type { HistoryEntry } from '../../db/types'
import type { DayData } from '../../types/app'
import type { JournalSaveStatus } from '../../hooks/useJournalCalendar'
import { EmptyState } from '../shared/EmptyState'
import { PanelCard } from '../shared/PanelCard'
import { PanelHeader } from '../shared/PanelHeader'
import { MoodPicker } from './MoodPicker'
import { useTranslation } from '../../i18n/useTranslation'

interface DayDetailPanelProps {
  liveDay: DayData
  selectedDay: number
  monthNames: readonly string[]
  currentMonth: number
  currentYear: number
  isLiveMonth: boolean
  todayDayOfMonth: number
  draftMood: string
  onMoodToggle: (value: string) => void
  draftNotes: string
  onNotesChange: (notes: string) => void
  selectedDayHistory: HistoryEntry[]
  activeThemeVars: { accentBlue: string; accentAmber: string }
  saveStatus: JournalSaveStatus
}

export function DayDetailPanel({
  liveDay,
  selectedDay,
  monthNames,
  currentMonth,
  currentYear,
  isLiveMonth,
  todayDayOfMonth,
  draftMood,
  onMoodToggle,
  draftNotes,
  onNotesChange,
  selectedDayHistory,
  activeThemeVars,
  saveStatus,
}: DayDetailPanelProps) {
  const { t } = useTranslation()
  const dateTitle = `${liveDay.dayName}, ${selectedDay} ${monthNames[currentMonth]} ${currentYear}`

  return (
    <PanelCard>
      <PanelHeader
        title={t('journalDayJournal')}
        bordered={false}
        className="mb-2"
        action={
          isLiveMonth && selectedDay === todayDayOfMonth ? (
            <span className="flex items-center gap-1 bg-accent-green/10 border border-accent-green/20 rounded-full px-2.5 py-0.5 text-micro font-bold text-accent-green uppercase">
              <span className="h-1 w-1 bg-accent-green rounded-full animate-ping" aria-hidden />
              <span>{t('commonToday')}</span>
            </span>
          ) : undefined
        }
      />
      <h2 className="text-sm font-bold text-primary mb-4">{dateTitle}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="surface-subtle p-3.5 rounded-[20px] border border-card">
          <span className="text-micro font-bold text-muted uppercase tracking-wide block">{t('journalStudyBlock')}</span>
          <span className="text-base font-extrabold text-accent-blue mt-0.5 font-mono">{liveDay.studyTime}</span>
        </div>
        <div className="surface-subtle p-3.5 rounded-[20px] border border-card">
          <span className="text-micro font-bold text-muted uppercase tracking-wide block">{t('journalBreakCooldown')}</span>
          <span className="text-base font-extrabold text-accent-amber mt-0.5 font-mono">{liveDay.breakTime}</span>
        </div>
        <div className="surface-subtle p-3.5 rounded-[20px] border border-card">
          <span className="text-micro font-bold text-muted uppercase tracking-wide block">{t('journalEfficiencyScore')}</span>
          <span className="text-base font-extrabold text-accent-green mt-0.5 font-mono">{liveDay.focusScore}</span>
        </div>
      </div>

      <MoodPicker draftMood={draftMood} onSelect={onMoodToggle} />

      <div className="mb-5">
        <div className="flex justify-between items-center mb-2.5">
          <h3 id="reflection-log-label" className="text-label font-semibold text-muted uppercase tracking-wider">{t('journalReflectionLog')}</h3>
          <div className="flex items-center gap-2" aria-live="polite" aria-atomic="true">
            {saveStatus === 'saving' && (
              <span className="text-micro font-mono text-muted animate-pulse">{t('commonSaving')}</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-micro font-mono text-accent-green">{t('commonSaved')}</span>
            )}
            <span className={`text-micro font-bold font-mono px-2 py-0.5 rounded-full ${
              draftNotes.length > 450
                ? 'bg-danger-muted text-danger border border-danger animate-pulse'
                : draftNotes.length > 350
                ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20'
                : 'text-muted'
            }`}>
              {draftNotes.length} / 500
            </span>
          </div>
        </div>
        <textarea
          value={draftNotes}
          onChange={e => onNotesChange(e.target.value.slice(0, 500))}
          maxLength={500}
          aria-labelledby="reflection-log-label"
          placeholder={t('journalReflectionPlaceholder')}
          rows={3}
          className={`focus-ring w-full resize-none rounded-2xl border surface-subtle focus:surface-track px-4 py-3 text-xs text-primary placeholder:text-muted outline-none transition-all duration-200 ${
            draftNotes.length >= 500
              ? 'border-danger/40 focus:border-danger/60'
              : draftNotes.length > 450
              ? 'border-accent-amber/40 focus:border-accent-amber/60'
              : 'border-card focus:border-accent-blue/40'
          }`}
        />
        {draftNotes.length >= 500 && (
          <p className="text-micro text-danger font-semibold mt-1.5 leading-normal">
            {t('journalCharLimitReached')}
          </p>
        )}
      </div>

      <div className="border-t border-card pt-5">
        <h3 className="text-caption font-semibold text-muted uppercase tracking-wider mb-3">{t('journalSessionTimeline')}</h3>
        {selectedDayHistory.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title={t('journalNoSessionsTitle')}
            description={t('journalNoSessionsDesc')}
          />
        ) : (
        <div className="relative w-full surface-subtle border border-card rounded-2xl p-4.5">
          <div className="relative h-6 w-full surface-subtle rounded-full border border-card overflow-hidden" role="group" aria-label={t('journalSessionTimeline')}>
            {selectedDayHistory.map((entry, idx) => {
              const parts = entry.timestamp.split(' ')
              if (parts.length < 3) return null
              const timePart = parts[2]
              const [hours, minutes] = timePart.split(':').map(Number)
              if (isNaN(hours) || isNaN(minutes)) return null

              const endMinute = hours * 60 + minutes
              const startMinute = Math.max(0, endMinute - entry.durationMinutes)
              const startPercent = (startMinute / 1440) * 100
              const widthPercent = ((endMinute - startMinute) / 1440) * 100
              const isStudy = entry.type === 'study'
              const sessionType = isStudy ? t('journalFocusBlock') : t('journalBreakTime')
              const sessionLabel = t('journalSessionAria', { type: sessionType, minutes: entry.durationMinutes, time: timePart })

              return (
                <button
                  key={idx}
                  type="button"
                  title={t('journalSessionTooltip', { type: sessionType, minutes: entry.durationMinutes, time: timePart })}
                  aria-label={sessionLabel}
                  className="focus-ring absolute top-0.5 bottom-0.5 rounded-full transition-all hover:scale-y-110 cursor-pointer"
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber,
                    boxShadow: `0 0 8px ${isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber}50`,
                  }}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-label text-muted font-mono mt-2 px-1.5 select-none font-bold">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>
        )}
      </div>
    </PanelCard>
  )
}
