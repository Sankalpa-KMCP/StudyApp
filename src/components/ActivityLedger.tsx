import React, { useState } from 'react'
import { Calendar } from 'lucide-react'
import type { CategoryItem, HistoryEntry } from '../db/types'

interface DayData {
  date: number
  dayName: string
  studyTime: string
  breakTime: string
  focusRatio: string
  sessionsCompleted: string
  focusScore: string
  intensity: 0 | 1 | 2 | 3
}

interface ActivityLedgerProps {
  selectedDay: number
  setSelectedDay: (day: number) => void
  currentMonth: number
  currentYear: number
  monthNames: string[]
  dayNames: string[]
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
  formatMinutes: (minutes: number) => string
  getIntensity: (minutes: number) => 0 | 1 | 2 | 3
  hexToRgb: (hex: string) => { r: number; g: number; b: number } | null
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
  formatMinutes,
  getIntensity,
  hexToRgb
}) => {
  const [draftMood, setDraftMood] = useState(initialDraftMood)
  const [draftNotes, setDraftNotes] = useState(initialDraftNotes)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Left Block (Calendar & Heatmap) - Grid 5 */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="border border-white/[0.06] dynamic-card p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="font-serif-luxury italic tracking-wide text-white/80 text-xs uppercase">03 / HISTORICAL LEDGER</span>
          </div>
          
          {/* Calendar Navigation header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-blue" />
              <span className="text-sm font-bold text-slate-200">{monthNames[currentMonth]} {currentYear}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={goPrevMonth} className="h-7 w-7 rounded-full border border-white/8 bg-white/5 hover:bg-white/10 text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">‹</button>
              <button onClick={goNextMonth} className="h-7 w-7 rounded-full border border-white/8 bg-white/5 hover:bg-white/10 text-sm transition-all flex items-center justify-center cursor-pointer active:scale-90 ios-active-scale">›</button>
              <select
                value={calendarCategoryFilter === 'all' ? 'all' : String(calendarCategoryFilter)}
                onChange={e => setCalendarCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="rounded-full border border-white/8 bg-white/5 hover:bg-white/10 px-3.5 py-1 text-xs text-text-secondary outline-none cursor-pointer transition-all active:scale-95 ios-active-scale"
              >
                <option value="all" className="bg-surface">All Subjects</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Day Label Grids */}
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {dayNames.map(d => (
              <div key={d} className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          {/* Heatmap Matrix grid */}
          <div className="grid grid-cols-7 gap-2">
            {(() => {
              const accentBlueRgb = hexToRgb(activeThemeVars.accentBlue) || { r: 56, g: 189, b: 248 }
              const accentBlueRgbStr = `${accentBlueRgb.r}, ${accentBlueRgb.g}, ${accentBlueRgb.b}`

              const getIntensityStyle = (intensity: 0 | 1 | 2 | 3) => {
                if (intensity === 0) return { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
                const opacity = intensity === 1 ? '0.25' : intensity === 2 ? '0.6' : '1.0'
                return {
                  backgroundColor: `rgba(${accentBlueRgbStr}, ${opacity})`,
                  color: intensity === 3 ? '#080b11' : '#ffffff'
                }
              }

              return dynamicGridCells.map((cell, i) => {
                const dayData = cell ? activeMonthData[cell - 1] : null
                const isLiveDay = isLiveMonth && cell === totalDaysInMonth
                const intensity = isLiveDay ? getIntensity(todayStudyMinutes) : (dayData?.intensity ?? 0)
                return cell ? (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(cell)}
                    className={`group relative aspect-square rounded-[10px] flex items-center justify-center text-xs font-bold transition-all duration-300 ease-out cursor-pointer ios-active-scale active:scale-95 ${
                      cell === selectedDay
                        ? 'ring-2 ring-accent-blue text-text-primary scale-110 z-10 shadow-md shadow-accent-blue/15'
                        : 'hover:scale-105 hover:z-10 hover:ring-1 hover:ring-white/20'
                    }`}
                    style={cell === selectedDay ? { backgroundColor: activeThemeVars.accentBlue, color: '#080b11' } : getIntensityStyle(intensity)}
                  >
                    <span>{cell}</span>
                    
                    {/* iOS 26 Glassmorphic Tooltip */}
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
              })
            })()}
          </div>

          {/* Legend scale */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[9px] text-slate-400 border-t border-white/5 pt-4">
            <div className="flex items-center gap-3">
              {(() => {
                const accentBlueRgb = hexToRgb(activeThemeVars.accentBlue) || { r: 56, g: 189, b: 248 }
                const accentBlueRgbStr = `${accentBlueRgb.r}, ${accentBlueRgb.g}, ${accentBlueRgb.b}`

                const getIntensityStyle = (intensity: 0 | 1 | 2 | 3) => {
                  if (intensity === 0) return { backgroundColor: 'rgba(255, 255, 255, 0.03)' }
                  const opacity = intensity === 1 ? '0.25' : intensity === 2 ? '0.6' : '1.0'
                  return { backgroundColor: `rgba(${accentBlueRgbStr}, ${opacity})` }
                }

                return [
                  { label: '0-1h', intensity: 0 as const },
                  { label: '1-2h', intensity: 1 as const },
                  { label: '2-3h', intensity: 2 as const },
                  { label: '3+h', intensity: 3 as const },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-1 font-bold">
                    <div className="h-2.5 w-2.5 rounded-md border border-white/5" style={getIntensityStyle(item.intensity)} />
                    <span>{item.label}</span>
                  </div>
                ))
              })()}
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

      {/* Right Block (Reflection notes & Focus timeline) - Grid 7 */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="rounded-2xl border border-white/5 dynamic-card p-6">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
            <div>
              <p className="text-[9px] font-bold text-accent-blue uppercase tracking-widest">Day Journal reflections</p>
              <h3 className="text-sm font-bold text-text-primary mt-0.5">
                {liveDay.dayName}, {selectedDay} {monthNames[currentMonth]} {currentYear}
              </h3>
            </div>
            {isLiveMonth && selectedDay === totalDaysInMonth && (
              <span className="flex items-center gap-1 bg-accent-green/10 border border-accent-green/20 rounded-full px-2.5 py-0.5 text-[9px] font-bold text-accent-green uppercase">
                <span className="h-1 w-1 bg-accent-green rounded-full animate-ping" />
                <span>Today</span>
              </span>
            )}
          </div>

          {/* Day summary numbers */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white/4 p-3.5 rounded-[20px] border border-white/8">
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-wide block">Study block</span>
              <span className="text-base font-extrabold text-accent-blue mt-0.5 font-mono">{liveDay.studyTime}</span>
            </div>
            <div className="bg-white/4 p-3.5 rounded-[20px] border border-white/8">
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-wide block">Break cooldown</span>
              <span className="text-base font-extrabold text-accent-amber mt-0.5 font-mono">{liveDay.breakTime}</span>
            </div>
            <div className="bg-white/4 p-3.5 rounded-[20px] border border-white/8">
              <span className="text-[9px] font-bold text-white/50 uppercase tracking-wide block">Efficiency score</span>
              <span className="text-base font-extrabold text-accent-green mt-0.5 font-mono">{liveDay.focusScore}</span>
            </div>
          </div>

          {/* Mood calibration deck */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-2.5">Track Mood</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Focused', emoji: '🧠', value: 'focused' },
                { label: 'Energetic', emoji: '⚡', value: 'energetic' },
                { label: 'Tired', emoji: '🥱', value: 'tired' },
                { label: 'Distracted', emoji: '🌪', value: 'distracted' },
              ].map(m => {
                const isSelected = draftMood === m.value
                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      const nextMood = draftMood === m.value ? '' : m.value
                      setDraftMood(nextMood)
                      handleMoodSelect(m.value)
                    }}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ios-active-scale ${
                      isSelected
                        ? 'border-accent-blue/30 bg-accent-blue/15 text-accent-blue shadow-sm'
                        : 'border-white/8 bg-white/4 text-text-secondary hover:border-white/15 hover:text-text-primary hover:bg-white/8'
                    }`}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Text reflection input */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-2.5">Reflection log</p>
            <textarea
              value={draftNotes}
              onChange={e => {
                const next = e.target.value
                setDraftNotes(next)
                handleNotesChange(next)
              }}
              placeholder="How did you perform? Note down any wins, hurdles, or focal points for today..."
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/8 bg-white/4 focus:bg-white/8 focus:border-accent-blue/40 px-4 py-3 text-xs text-text-primary placeholder:text-white/35 outline-none transition-all duration-200"
            />
          </div>

          {/* Visual 24h study timeline */}
          <div className="border-t border-white/8 pt-5">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-3">Focus Horizon Timeline (24h)</p>
            <div className="relative w-full bg-white/4 border border-white/8 rounded-2xl p-4.5">
              <div className="relative h-6 w-full bg-white/5 rounded-full border border-white/8 overflow-hidden">
                <div className="absolute inset-0 flex justify-between pointer-events-none text-[8px] text-white/20 font-mono">
                  <div className="h-full border-r border-white/8" style={{ left: '25%' }} />
                  <div className="h-full border-r border-white/8" style={{ left: '50%' }} />
                  <div className="h-full border-r border-white/8" style={{ left: '75%' }} />
                </div>

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
                  
                  return (
                    <div
                      key={idx}
                      title={`${isStudy ? 'Focus block' : 'Break time'}: ${entry.durationMinutes}m (ending ${timePart})`}
                      className="absolute top-0.5 bottom-0.5 rounded-full transition-all hover:scale-y-110 cursor-pointer"
                      style={{
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber,
                        boxShadow: `0 0 8px ${isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber}50`
                      }}
                    />
                  )
                })}
              </div>
              <div className="flex justify-between text-[8px] text-white/40 font-mono mt-2 px-1.5 select-none font-bold">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
