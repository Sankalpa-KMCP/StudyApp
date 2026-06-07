import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import type { CategoryItem, HistoryEntry } from '../db/types'
import type { DayData } from '../types/app'
import { formatMinutes, getIntensity } from '../lib/studyDashboard'
import { DayDetailPanel } from './activity-ledger/DayDetailPanel'
import { useLedgerIntensityStyles } from './activity-ledger/useLedgerCalendar'

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
  todayStudyMinutes: number
  todayBreakMinutes: number
  progressPercent: number
  liveDay: DayData
  initialDraftMood: string
  handleMoodSelect: (val: string) => void
  initialDraftNotes: string
  handleNotesChange: (notes: string) => void
  selectedDayHistory: HistoryEntry[]
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
  totalDaysInMonth,
  todayStudyMinutes,
  todayBreakMinutes,
  progressPercent,
  liveDay,
  initialDraftMood,
  handleMoodSelect,
  initialDraftNotes,
  handleNotesChange,
  selectedDayHistory,
}) => {
  const [draftMood, setDraftMood] = useState(initialDraftMood)
  const [draftNotes, setDraftNotes] = useState(initialDraftNotes)
  const { getIntensityStyle, getLegendStyle } = useLedgerIntensityStyles(activeThemeVars.accentBlue)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="border border-white/[0.06] dynamic-card p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="font-serif-luxury italic tracking-wide text-white/80 text-xs uppercase">03 / HISTORICAL LEDGER</span>
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-blue" />
              <span className="text-sm font-bold text-slate-200">{monthNames[currentMonth]} {currentYear}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous month" onClick={goPrevMonth} className="h-7 w-7 rounded-full border border-white/8 bg-white/5 hover:bg-white/10 text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">‹</button>
              <button type="button" aria-label="Next month" onClick={goNextMonth} className="h-7 w-7 rounded-full border border-white/8 bg-white/5 hover:bg-white/10 text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">›</button>
              <select
                value={calendarCategoryFilter === 'all' ? 'all' : String(calendarCategoryFilter)}
                onChange={e => setCalendarCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                aria-label="Filter calendar by subject"
                className="rounded-full border border-white/8 bg-white/5 hover:bg-white/10 px-3.5 py-1 text-xs text-text-secondary outline-none cursor-pointer transition-all active:scale-95 ios-active-scale"
              >
                <option value="all" className="bg-surface">All Subjects</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
            {dayNames.map(d => (
              <div key={d} className="text-label font-bold text-slate-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2.5" role="grid" aria-label={`${monthNames[currentMonth]} ${currentYear} study calendar`}>
            {dynamicGridCells.map((cell, i) => {
              const dayData = cell ? activeMonthData[cell - 1] : null
              const isLiveDay = isLiveMonth && cell === totalDaysInMonth
              const intensity = isLiveDay ? getIntensity(todayStudyMinutes) : (dayData?.intensity ?? 0)
              const cellLabel = cell ? `${monthNames[currentMonth]} ${cell}, ${currentYear}` : ''
              const studyLabel = isLiveDay ? formatMinutes(todayStudyMinutes) : (dayData?.studyTime ?? '0m')

              return cell ? (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={`${cellLabel}, focus ${studyLabel}`}
                  aria-selected={cell === selectedDay}
                  onClick={() => setSelectedDay(cell)}
                  className={`group relative aspect-square min-h-[40px] rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ease-out cursor-pointer ios-active-scale active:scale-95 ${
                    cell === selectedDay
                      ? 'ring-2 ring-accent-blue text-text-primary scale-110 z-10 shadow-md shadow-accent-blue/15'
                      : 'hover:scale-105 hover:z-10 hover:ring-1 hover:ring-white/20'
                  }`}
                  style={cell === selectedDay ? { backgroundColor: activeThemeVars.accentBlue, color: '#080b11' } : getIntensityStyle(intensity)}
                >
                  <span>{cell}</span>
                  {dayData && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col w-36 bg-[#161620]/90 backdrop-blur-xl border border-white/10 p-2.5 rounded-[16px] text-[9px] font-mono text-left pointer-events-none z-30 shadow-[0_8px_32px_rgba(0,0,0,0.35)] leading-normal animate-slide-in-up">
                      <div className="font-bold text-white mb-1 border-b border-white/10 pb-0.5">
                        {monthNames[currentMonth]} {cell}, {currentYear}
                      </div>
                      <div className="text-white/80">⏱️ Focus: {isLiveDay ? formatMinutes(todayStudyMinutes) : dayData.studyTime}</div>
                      <div className="text-white/60">☕ Break: {isLiveDay ? formatMinutes(todayBreakMinutes) : dayData.breakTime}</div>
                      <div className="text-accent-blue font-bold mt-0.5">🎯 Score: {isLiveDay ? `${progressPercent}%` : dayData.focusScore}</div>
                    </div>
                  )}
                </button>
              ) : (
                <div key={i} className="aspect-square" />
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-label text-slate-400 border-t border-white/5 pt-4">
            <div className="flex items-center gap-3">
              {[
                { label: '0-1h', intensity: 0 as const },
                { label: '1-2h', intensity: 1 as const },
                { label: '2-3h', intensity: 2 as const },
                { label: '3+h', intensity: 3 as const },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1 font-bold">
                  <div className="h-2.5 w-2.5 rounded-md border border-white/5" style={getLegendStyle(item.intensity)} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 font-bold">
              <span>Low</span>
              {[0.3, 0.6, 1].map((opacity, i) => (
                <div key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: activeThemeVars.accentBlue, opacity }} />
              ))}
              <span>High</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <DayDetailPanel
          liveDay={liveDay}
          selectedDay={selectedDay}
          monthNames={monthNames}
          currentMonth={currentMonth}
          currentYear={currentYear}
          isLiveMonth={isLiveMonth}
          totalDaysInMonth={totalDaysInMonth}
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
        />
      </div>
    </div>
  )
}
