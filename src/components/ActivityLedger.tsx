import React, { useState } from 'react'
import { Calendar, X, Timer, Coffee, Target } from 'lucide-react'
import type { CategoryItem, HistoryEntry } from '../db/types'
import type { DayData } from '../types/app'
import type { JournalSaveStatus } from '../hooks/useJournalCalendar'
import { formatMinutes, getIntensity } from '../lib/study/studyDashboard'
import { DayDetailPanel } from './activity-ledger/DayDetailPanel'
import { useLedgerIntensityStyles } from '../hooks/activity-ledger/useLedgerCalendar'
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
  const { getIntensityStyle, getLegendStyle } = useLedgerIntensityStyles(activeThemeVars.accentBlue)

  const showJournalHint =
    !journalHintDismissed &&
    todayStudyMinutes === 0 &&
    activeMonthData.every(day => day.intensity === 0)

  const dismissJournalHint = () => {
    localStorage.setItem('journal_hint_dismissed', 'true')
    setJournalHintDismissed(true)
  }

  const legendItems = [
    { label: t('journalLegend0to1h'), intensity: 0 as const },
    { label: t('journalLegend1to2h'), intensity: 1 as const },
    { label: t('journalLegend2to3h'), intensity: 2 as const },
    { label: t('journalLegend3plus'), intensity: 3 as const },
  ]

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

          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
            {dayNames.map(d => (
              <div key={d} className="text-label font-bold text-secondary uppercase tracking-widest">{d}</div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5" role="grid" aria-label={t('journalCalendarAria', { month: monthNames[currentMonth], year: currentYear })}>
            {Array.from({ length: Math.ceil(dynamicGridCells.length / 7) }, (_, weekIdx) => (
              <div key={weekIdx} role="row" className="grid grid-cols-7 gap-2.5">
                {dynamicGridCells.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell, cellIdx) => {
              const i = weekIdx * 7 + cellIdx
              const dayData = cell ? activeMonthData[cell - 1] : null
              const isLiveDay = isLiveMonth && cell === todayDayOfMonth
              const intensity = isLiveDay ? getIntensity(todayStudyMinutes) : (dayData?.intensity ?? 0)
              const cellLabel = cell ? `${monthNames[currentMonth]} ${cell}, ${currentYear}` : ''
              const studyLabel = isLiveDay ? formatMinutes(todayStudyMinutes) : (dayData?.studyTime ?? '0m')

              return cell ? (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={t('journalCellAria', { date: cellLabel, study: studyLabel })}
                  aria-selected={cell === selectedDay}
                  onClick={() => setSelectedDay(cell)}
                  className={`focus-ring group relative aspect-square min-h-[40px] rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ease-out cursor-pointer ios-active-scale active:scale-95 ${
                    cell === selectedDay
                      ? 'ring-2 ring-accent-blue text-on-accent scale-110 z-10 shadow-md shadow-accent-blue/15'
                      : 'hover:scale-105 hover:z-10 hover:ring-1 hover:ring-white/20'
                  }`}
                  style={cell === selectedDay ? { backgroundColor: activeThemeVars.accentBlue } : getIntensityStyle(intensity)}
                >
                  <span>{cell}</span>
                  {dayData && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden md:group-hover:flex flex-col w-36 surface-overlay border border-card p-2.5 rounded-2xl text-micro font-mono text-left pointer-events-none z-30 leading-normal animate-slide-in-up" style={{ boxShadow: 'var(--shadow-elevated)' }}>
                      <div className="font-bold text-primary mb-1 border-b border-card pb-0.5">
                        {monthNames[currentMonth]} {cell}, {currentYear}
                      </div>
                      <div className="flex items-center gap-1 text-secondary">
                        <Timer className="h-3 w-3 shrink-0" aria-hidden />
                        {t('journalTooltipFocus', { time: isLiveDay ? formatMinutes(todayStudyMinutes) : dayData.studyTime })}
                      </div>
                      <div className="flex items-center gap-1 text-muted">
                        <Coffee className="h-3 w-3 shrink-0" aria-hidden />
                        {t('journalTooltipBreak', { time: isLiveDay ? formatMinutes(todayBreakMinutes) : dayData.breakTime })}
                      </div>
                      <div className="flex items-center gap-1 text-accent-blue font-bold mt-0.5">
                        <Target className="h-3 w-3 shrink-0" aria-hidden />
                        {t('journalTooltipScore', { score: isLiveDay ? `${progressPercent}%` : dayData.focusScore })}
                      </div>
                    </div>
                  )}
                </button>
              ) : (
                <div key={i} className="aspect-square" role="gridcell" aria-hidden />
              )
                })}
              </div>
            ))}
          </div>

          <div className="md:hidden mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-card surface-subtle px-3 py-2 text-micro font-mono text-secondary">
            <span className="font-bold text-primary w-full text-micro uppercase tracking-wider">
              {monthNames[currentMonth]} {selectedDay}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3 w-3 text-accent-blue" aria-hidden />
              {liveDay.studyTime}
            </span>
            <span className="text-muted">·</span>
            <span className="inline-flex items-center gap-1">
              <Coffee className="h-3 w-3 text-accent-amber" aria-hidden />
              {liveDay.breakTime}
            </span>
            <span className="text-muted">·</span>
            <span className="inline-flex items-center gap-1 text-accent-blue font-bold">
              <Target className="h-3 w-3" aria-hidden />
              {liveDay.focusScore}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-label text-secondary border-t border-card pt-4">
            <div className="flex items-center gap-3">
              {legendItems.map(item => (
                <div key={item.label} className="flex items-center gap-1 font-bold">
                  <div className="h-2.5 w-2.5 rounded-md border border-card" style={getLegendStyle(item.intensity)} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <span>{t('commonLow')}</span>
              {[0.3, 0.6, 1].map((opacity, i) => (
                <div key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: activeThemeVars.accentBlue, opacity }} />
              ))}
              <span>{t('commonHigh')}</span>
            </div>
          </div>
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
