import type { HistoryEntry } from '../../db/types'
import type { DayData } from '../../types/app'
import { MoodPicker } from './MoodPicker'

interface DayDetailPanelProps {
  liveDay: DayData
  selectedDay: number
  monthNames: readonly string[]
  currentMonth: number
  currentYear: number
  isLiveMonth: boolean
  totalDaysInMonth: number
  draftMood: string
  onMoodToggle: (value: string) => void
  draftNotes: string
  onNotesChange: (notes: string) => void
  selectedDayHistory: HistoryEntry[]
  activeThemeVars: { accentBlue: string; accentAmber: string }
}

export function DayDetailPanel({
  liveDay,
  selectedDay,
  monthNames,
  currentMonth,
  currentYear,
  isLiveMonth,
  totalDaysInMonth,
  draftMood,
  onMoodToggle,
  draftNotes,
  onNotesChange,
  selectedDayHistory,
  activeThemeVars,
}: DayDetailPanelProps) {
  return (
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

      <MoodPicker draftMood={draftMood} onSelect={onMoodToggle} />

      <div className="mb-5">
        <div className="flex justify-between items-center mb-2.5">
          <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider">Reflection log</p>
          <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
            draftNotes.length > 450
              ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse'
              : draftNotes.length > 350
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-white/40'
          }`}>
            {draftNotes.length} / 500
          </span>
        </div>
        <textarea
          value={draftNotes}
          onChange={e => onNotesChange(e.target.value.slice(0, 500))}
          maxLength={500}
          placeholder="How did you perform? Note down any wins, hurdles, or focal points for today..."
          rows={3}
          className={`w-full resize-none rounded-2xl border bg-white/4 focus:bg-white/8 px-4 py-3 text-xs text-text-primary placeholder:text-white/35 outline-none transition-all duration-200 ${
            draftNotes.length >= 500
              ? 'border-red-500/40 focus:border-red-500/60'
              : draftNotes.length > 450
              ? 'border-amber-500/40 focus:border-amber-500/60'
              : 'border-white/8 focus:border-accent-blue/40'
          }`}
        />
        {draftNotes.length >= 500 && (
          <p className="text-[9px] text-red-400 font-semibold mt-1.5 leading-normal">
            ⚠️ Character limit reached (500 maximum). Please condense your thoughts.
          </p>
        )}
      </div>

      <div className="border-t border-white/8 pt-5">
        <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-3">Focus Horizon Timeline (24h)</p>
        <div className="relative w-full bg-white/4 border border-white/8 rounded-2xl p-4.5">
          <div className="relative h-6 w-full bg-white/5 rounded-full border border-white/8 overflow-hidden">
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
                  aria-label={`${isStudy ? 'Focus block' : 'Break time'}: ${entry.durationMinutes} minutes ending ${timePart}`}
                  className="absolute top-0.5 bottom-0.5 rounded-full transition-all hover:scale-y-110 cursor-pointer"
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
  )
}
