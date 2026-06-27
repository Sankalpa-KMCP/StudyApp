import React, { useState } from 'react'
import { Calendar, X } from 'lucide-react'
import type { CategoryItem, HistoryEntry } from '../db/types'
import type { DayData } from '../types/app'
import type { JournalSaveStatus } from '../hooks/useJournalCalendar'
import { DayDetailPanel } from './activity-ledger/DayDetailPanel'
import { ActivityCalendarGrid } from './activity-ledger/ActivityCalendarGrid'
import { TabPageShell } from './shared/TabPageShell'
import { PanelCard } from './shared/PanelCard'
import { PanelHeader } from './shared/PanelHeader'
import { useTranslation } from '../i18n/useTranslation'

interface ActivityLedgerProps {
  selectedDay: number
  setSelectedDay: (day: number) => void
  currentMonth: number
  currentYear: number
  monthNames: readonly string[]
  dayNames: readonly string[]
  goPrevMonth: () => void
  goNextMonth: () => void
  calendarCategoryFilter: 'all' | number
  setCalendarCategoryFilter: (val: 'all' | number) => void
  categories: CategoryItem[]
  activeThemeVars: { accentBlue: string; accentAmber: string }
  dynamicGridCells: Array<number | null>
  activeMonthData: DayData[]
  isLiveMonth: boolean
  totalDaysInMonth: number
  todayDayOfMonth: number
  todayStudyMinutes: number
  todayBreakMinutes: number
  progressPercent: number
  liveDay: DayData
  initialDraftMood: string
  handleMoodSelect: (val: string) => void
  initialDraftNotes: string
  handleNotesChange: (notes: string) => void
  selectedDayHistory: HistoryEntry[]
  saveStatus: JournalSaveStatus
}

export const ActivityLedger: React.FC<ActivityLedgerProps> = ({
  selectedDay,
  setSelectedDay,
  currentMonth,
  currentYear,
  monthNames,
  dayNames,
  goPrevMonth,
  goNextMonth,
  calendarCategoryFilter,
  setCalendarCategoryFilter,
  categories,
  activeThemeVars,
  dynamicGridCells,
  activeMonthData,
  isLiveMonth,
  todayDayOfMonth,
  todayStudyMinutes,
  todayBreakMinutes,
  progressPercent,
  liveDay,
  initialDraftMood,
  handleMoodSelect,
  initialDraftNotes,
  handleNotesChange,
  selectedDayHistory,
  saveStatus,
}) => {
  const { t } = useTranslation()
  const [draftMood, setDraftMood] = useState(initialDraftMood)
  const [draftNotes, setDraftNotes] = useState(initialDraftNotes)
  const [journalHintDismissed, setJournalHintDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('journal_hint_dismissed'),
  )

  const showJournalHint =
    !journalHintDismissed &&
    todayStudyMinutes === 0 &&
    activeMonthData.every(day => day.intensity === 0)

  const dismissJournalHint = () => {
    localStorage.setItem('journal_hint_dismissed', 'true')
    setJournalHintDismissed(true)
  }

  return (
    <TabPageShell>
      {showJournalHint && (
        <div className="lg:col-span-12 flex items-start justify-between gap-3 rounded-2xl border border-accent-blue/20 bg-accent-blue/10 px-4 py-3">
          <p className="text-xs text-secondary leading-relaxed">
            {t('journalHintBody')}
          </p>
          <button
            type="button"
            onClick={dismissJournalHint}
            aria-label={t('journalHintDismiss')}
            className="focus-ring shrink-0 rounded-full p-1 text-muted hover:text-primary hover:surface-track transition-all ios-active-scale"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <PanelCard>
          <PanelHeader title={t('journalHelper')} bordered={false} className="mb-1" />
          <p className="text-micro text-muted font-medium mb-4">{t('journalPanelHelper')}</p>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-blue" />
              <span className="text-sm font-bold text-primary">{monthNames[currentMonth]} {currentYear}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={t('journalPreviousMonth')} onClick={goPrevMonth} className="focus-ring h-7 w-7 rounded-full border border-card surface-subtle hover:surface-track text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">‹</button>
              <button type="button" aria-label={t('journalNextMonth')} onClick={goNextMonth} className="focus-ring h-7 w-7 rounded-full border border-card surface-subtle hover:surface-track text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">›</button>
              <select
                value={calendarCategoryFilter === 'all' ? 'all' : String(calendarCategoryFilter)}
                onChange={e => setCalendarCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                aria-label={t('journalFilterSubjects')}
                className="focus-ring rounded-full border border-card surface-subtle hover:surface-track px-3.5 py-1 text-xs text-secondary outline-none cursor-pointer transition-all active:scale-95 ios-active-scale"
              >
                <option value="all" className="bg-surface">{t('journalAllSubjects')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <ActivityCalendarGrid
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            currentMonth={currentMonth}
            currentYear={currentYear}
            monthNames={monthNames}
            dayNames={dayNames}
            dynamicGridCells={dynamicGridCells}
            activeMonthData={activeMonthData}
            isLiveMonth={isLiveMonth}
            todayDayOfMonth={todayDayOfMonth}
            todayStudyMinutes={todayStudyMinutes}
            todayBreakMinutes={todayBreakMinutes}
            progressPercent={progressPercent}
            liveDay={liveDay}
            activeThemeVars={activeThemeVars}
          />
        </PanelCard>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <DayDetailPanel
          liveDay={liveDay}
          selectedDay={selectedDay}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          isLiveMonth={isLiveMonth}
          todayDayOfMonth={todayDayOfMonth}
          draftMood={draftMood}
          onMoodToggle={value => {
            const nextMood = draftMood === value ? '' : value
            setDraftMood(nextMood)
            handleMoodSelect(value)
          }}
          draftNotes={draftNotes}
          onNotesChange={notes => {
            setDraftNotes(notes)
            handleNotesChange(notes)
          }}
          selectedDayHistory={selectedDayHistory}
          activeThemeVars={activeThemeVars}
          saveStatus={saveStatus}
        />
      </div>
    </TabPageShell>
  )
}
