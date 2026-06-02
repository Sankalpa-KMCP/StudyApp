import { useState } from 'react'
import { Brain, BookOpen, Zap, Clock, BarChart3, Target, Flame, Calendar, Award, Coffee } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const weeklyData = [
  { day: 'Mon', hours: 8.5, focus: 85 },
  { day: 'Tue', hours: 7.8, focus: 72 },
  { day: 'Wed', hours: 9.2, focus: 90 },
  { day: 'Thu', hours: 8.0, focus: 78 },
  { day: 'Fri', hours: 8.7, focus: 95 },
  { day: 'Sat', hours: 7.5, focus: 80 },
  { day: 'Sun', hours: 9.6, focus: 88 },
]

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

const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDayName(date: number): string {
  return dayNames[(5 + date - 1) % 7]
}

const mayData: DayData[] = [
  { date: 1, dayName: getDayName(1), studyTime: '8h 30m', breakTime: '1h 15m', focusRatio: '91%', sessionsCompleted: '16 of 17', focusScore: '93%', intensity: 3 },
  { date: 2, dayName: getDayName(2), studyTime: '7h 45m', breakTime: '0h 50m', focusRatio: '87%', sessionsCompleted: '14 of 16', focusScore: '89%', intensity: 2 },
  { date: 3, dayName: getDayName(3), studyTime: '9h 15m', breakTime: '1h 10m', focusRatio: '94%', sessionsCompleted: '17 of 17', focusScore: '96%', intensity: 3 },
  { date: 4, dayName: getDayName(4), studyTime: '6h 30m', breakTime: '0h 45m', focusRatio: '82%', sessionsCompleted: '12 of 15', focusScore: '84%', intensity: 1 },
  { date: 5, dayName: getDayName(5), studyTime: '8h 00m', breakTime: '1h 00m', focusRatio: '90%', sessionsCompleted: '15 of 16', focusScore: '91%', intensity: 2 },
  { date: 6, dayName: getDayName(6), studyTime: '8h 45m', breakTime: '1h 05m', focusRatio: '93%', sessionsCompleted: '16 of 17', focusScore: '94%', intensity: 3 },
  { date: 7, dayName: getDayName(7), studyTime: '5h 15m', breakTime: '0h 35m', focusRatio: '78%', sessionsCompleted: '10 of 14', focusScore: '80%', intensity: 0 },
  { date: 8, dayName: getDayName(8), studyTime: '9h 00m', breakTime: '1h 20m', focusRatio: '92%', sessionsCompleted: '17 of 17', focusScore: '95%', intensity: 3 },
  { date: 9, dayName: getDayName(9), studyTime: '7h 30m', breakTime: '0h 55m', focusRatio: '86%', sessionsCompleted: '14 of 16', focusScore: '88%', intensity: 2 },
  { date: 10, dayName: getDayName(10), studyTime: '8h 15m', breakTime: '1h 10m', focusRatio: '89%', sessionsCompleted: '15 of 16', focusScore: '92%', intensity: 2 },
  { date: 11, dayName: getDayName(11), studyTime: '9h 30m', breakTime: '1h 25m', focusRatio: '95%', sessionsCompleted: '17 of 17', focusScore: '97%', intensity: 3 },
  { date: 12, dayName: getDayName(12), studyTime: '6h 45m', breakTime: '0h 50m', focusRatio: '83%', sessionsCompleted: '12 of 15', focusScore: '85%', intensity: 1 },
  { date: 13, dayName: getDayName(13), studyTime: '7h 00m', breakTime: '0h 45m', focusRatio: '84%', sessionsCompleted: '13 of 16', focusScore: '86%', intensity: 1 },
  { date: 14, dayName: getDayName(14), studyTime: '4h 30m', breakTime: '0h 30m', focusRatio: '75%', sessionsCompleted: '9 of 13', focusScore: '77%', intensity: 0 },
  { date: 15, dayName: getDayName(15), studyTime: '8h 50m', breakTime: '1h 15m', focusRatio: '94%', sessionsCompleted: '16 of 17', focusScore: '95%', intensity: 3 },
  { date: 16, dayName: getDayName(16), studyTime: '7h 15m', breakTime: '1h 00m', focusRatio: '85%', sessionsCompleted: '13 of 15', focusScore: '88%', intensity: 2 },
  { date: 17, dayName: getDayName(17), studyTime: '8h 40m', breakTime: '1h 05m', focusRatio: '91%', sessionsCompleted: '15 of 16', focusScore: '93%', intensity: 3 },
  { date: 18, dayName: getDayName(18), studyTime: '9h 10m', breakTime: '1h 30m', focusRatio: '96%', sessionsCompleted: '17 of 17', focusScore: '97%', intensity: 3 },
  { date: 19, dayName: getDayName(19), studyTime: '6h 00m', breakTime: '0h 40m', focusRatio: '80%', sessionsCompleted: '11 of 15', focusScore: '82%', intensity: 1 },
  { date: 20, dayName: getDayName(20), studyTime: '8h 20m', breakTime: '1h 10m', focusRatio: '90%', sessionsCompleted: '15 of 16', focusScore: '92%', intensity: 2 },
  { date: 21, dayName: getDayName(21), studyTime: '7h 50m', breakTime: '0h 55m', focusRatio: '88%', sessionsCompleted: '14 of 16', focusScore: '90%', intensity: 2 },
  { date: 22, dayName: getDayName(22), studyTime: '9h 05m', breakTime: '1h 20m', focusRatio: '93%', sessionsCompleted: '16 of 17', focusScore: '96%', intensity: 3 },
  { date: 23, dayName: getDayName(23), studyTime: '8h 10m', breakTime: '1h 05m', focusRatio: '89%', sessionsCompleted: '15 of 17', focusScore: '91%', intensity: 3 },
  { date: 24, dayName: getDayName(24), studyTime: '7h 30m', breakTime: '0h 50m', focusRatio: '86%', sessionsCompleted: '13 of 15', focusScore: '88%', intensity: 2 },
  { date: 25, dayName: getDayName(25), studyTime: '8h 45m', breakTime: '1h 15m', focusRatio: '92%', sessionsCompleted: '16 of 17', focusScore: '94%', intensity: 3 },
  { date: 26, dayName: getDayName(26), studyTime: '9h 20m', breakTime: '1h 25m', focusRatio: '95%', sessionsCompleted: '17 of 17', focusScore: '97%', intensity: 3 },
  { date: 27, dayName: getDayName(27), studyTime: '6h 50m', breakTime: '0h 45m', focusRatio: '84%', sessionsCompleted: '12 of 15', focusScore: '86%', intensity: 1 },
  { date: 28, dayName: getDayName(28), studyTime: '8h 35m', breakTime: '1h 10m', focusRatio: '91%', sessionsCompleted: '15 of 16', focusScore: '93%', intensity: 3 },
  { date: 29, dayName: getDayName(29), studyTime: '7h 20m', breakTime: '0h 55m', focusRatio: '85%', sessionsCompleted: '13 of 16', focusScore: '87%', intensity: 2 },
  { date: 30, dayName: getDayName(30), studyTime: '8h 00m', breakTime: '1h 00m', focusRatio: '88%', sessionsCompleted: '14 of 16', focusScore: '90%', intensity: 2 },
  { date: 31, dayName: getDayName(31), studyTime: '8h 45m', breakTime: '1h 02m', focusRatio: '89%', sessionsCompleted: '16 of 17', focusScore: '94%', intensity: 3 },
]

const gridCells: (number | null)[] = [
  null, null, null, null, null, 1, 2,
  3, 4, 5, 6, 7, 8, 9,
  10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30,
  31, null, null, null, null, null, null,
]

const intensityColors = ['bg-intensity-0', 'bg-intensity-1', 'bg-intensity-2', 'bg-intensity-3']

interface MicroCardItem {
  icon: React.ReactNode
  label: string
  value: string
  badge: { text: string; dot?: boolean }
  iconBg: string
  badgeBg: string
  badgeText: string
}

const tooltipStyle = {
  background: '#131926',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  outline: 'none',
}

function MicroCard({ icon, label, value, badge, iconBg, badgeBg, badgeText }: MicroCardItem) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border-card bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-base font-semibold text-text-primary">{value}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${badgeBg}`}>
        {badge.dot && <span className="h-1.5 w-1.5 rounded-full bg-accent-amber animate-pulse-soft" />}
        <span className={`text-xs font-medium ${badgeText}`}>{badge.text}</span>
      </div>
    </div>
  )
}

function App() {
  const [selectedDay, setSelectedDay] = useState(31)
  const day = mayData[selectedDay - 1]
  return (
    <div className="min-h-screen bg-surface p-6 font-sans text-text-primary antialiased">
      <div className="mx-auto grid max-w-[1440px] grid-cols-12 gap-6">

        {/* LEFT COLUMN */}
        <div className="col-span-7 flex flex-col gap-6">

          {/* CARD 1: Today's Progress */}
          <div className="rounded-2xl border border-border-card bg-surface-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-5 w-5 text-accent-blue" />
              <h2 className="text-lg font-semibold">Today's Progress</h2>
            </div>
            <div className="flex gap-8">
              {/* Left - Circular Ring + Stats */}
              <div className="flex w-44 shrink-0 flex-col items-center">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <defs>
                      <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1E293B" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="50"
                      fill="none" stroke="#3B82F6"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="314.16"
                      strokeDashoffset="0"
                      filter="url(#glow)"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary">8h 45m</p>
                    <p className="text-xs text-text-muted">of 8h goal</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-text-secondary">Study time</p>
                <div className="mt-3 flex w-full flex-col gap-1.5">
                  {[
                    { label: 'Focus', value: '8h 45m', valueClass: 'text-text-primary' },
                    { label: 'Break', value: '1h 2m', valueClass: 'text-text-primary' },
                    { label: 'Progress', value: '100%', valueClass: 'text-accent-green' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between border-b border-border-subtle pb-1 last:border-0">
                      <span className="text-xs text-text-muted">{row.label}</span>
                      <span className={`text-xs font-semibold ${row.valueClass}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right - Micro Cards */}
              <div className="flex flex-1 flex-col justify-center gap-3">
                <MicroCard
                  icon={<Brain className="h-5 w-5 text-accent-purple" />}
                  label="Focus score"
                  value="94%"
                  badge={{ text: '+16% avg' }}
                  iconBg="bg-accent-purple/10"
                  badgeBg="bg-accent-purple/10"
                  badgeText="text-accent-purple"
                />
                <MicroCard
                  icon={<BookOpen className="h-5 w-5 text-accent-green" />}
                  label="Sessions done"
                  value="16 of 17"
                  badge={{ text: '1 left' }}
                  iconBg="bg-accent-green/10"
                  badgeBg="bg-accent-green/10"
                  badgeText="text-accent-green"
                />
                <MicroCard
                  icon={<Zap className="h-5 w-5 text-accent-amber" />}
                  label="Streak"
                  value="14 days"
                  badge={{ text: 'Active', dot: true }}
                  iconBg="bg-accent-amber/10"
                  badgeBg="bg-accent-amber/10"
                  badgeText="text-accent-amber"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: Weekly Rhythm */}
          <div className="rounded-2xl border border-border-card bg-surface-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent-blue" />
              <h2 className="text-lg font-semibold">Weekly Rhythm</h2>
            </div>
            {/* Top Metrics Row */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              {[
                { label: 'Study time', value: '59.3h', icon: <Clock className="h-3.5 w-3.5 text-accent-blue" /> },
                { label: 'Break time', value: '7h', icon: <Coffee className="h-3.5 w-3.5 text-accent-amber" /> },
                { label: 'Active days', value: '7/7', icon: <Calendar className="h-3.5 w-3.5 text-accent-green" /> },
                { label: 'Best day', value: 'Thu', icon: <Award className="h-3.5 w-3.5 text-accent-purple" /> },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface/50 px-3 py-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface">
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-[11px] text-text-muted">{m.label}</p>
                    <p className="text-sm font-semibold">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border-subtle bg-surface/30 p-4">
                <p className="mb-3 text-xs font-medium text-text-secondary">Study hours trend</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} domain={[0, 12]} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}
                      itemStyle={{ color: '#F8FAFC', fontSize: 13 }}
                    />
                    <Area type="monotone" dataKey="hours" stroke="#3B82F6" strokeWidth={2} fill="url(#areaGradient)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface/30 p-4">
                <p className="mb-3 text-xs font-medium text-text-secondary">Daily focus bars</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v: string) => v.charAt(0)} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}
                      formatter={(value) => [`${value}%`, 'Focus']}
                    />
                    <Bar dataKey="focus" fill="url(#barGradient)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* CARD 3: This Month */}
          <div className="rounded-2xl border border-border-card bg-surface-card p-6">
            <div className="mb-5 flex items-center gap-2">
              <Flame className="h-5 w-5 text-accent-amber" />
              <h2 className="text-lg font-semibold">This Month</h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-card">
              <div className="flex flex-col items-center px-4 first:pl-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                    <Clock className="h-5 w-5 text-accent-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Total Hours</p>
                    <p className="text-xl font-bold">246.8h</p>
                  </div>
                </div>
                <div className="mt-3 h-0.5 w-full max-w-[200px] rounded-full bg-accent-blue/60" />
              </div>
              <div className="flex flex-col items-center px-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                    <BookOpen className="h-5 w-5 text-accent-purple" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Sessions</p>
                    <p className="text-xl font-bold">484</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-1.5 rounded-sm ${i < 7 ? 'bg-accent-purple/70' : 'bg-accent-purple/20'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center px-4 last:pr-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                    <Target className="h-5 w-5 text-accent-green" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Avg / Day</p>
                    <p className="text-xl font-bold">8h</p>
                  </div>
                </div>
                <div className="mt-3 h-0.5 w-full max-w-[200px] rounded-full bg-accent-green/60" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-5">

          {/* CARD 4: Monthly Overview */}
          <div className="flex h-full flex-col rounded-2xl border border-border-card bg-surface-card p-6">
            {/* Month Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent-blue" />
                <h2 className="text-lg font-semibold">May 2026</h2>
              </div>
              <div className="flex items-center gap-1 text-text-muted">
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface hover:text-text-primary">‹</button>
                <span className="text-xs font-medium">May 2026</span>
                <button className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface hover:text-text-primary">›</button>
              </div>
            </div>
            {/* Day Labels */}
            <div className="mb-1.5 grid grid-cols-7 gap-1">
              {dayNames.map((d) => (
                <div key={d} className="py-1 text-center text-[11px] font-medium text-text-muted">{d}</div>
              ))}
            </div>
            {/* Calendar Grid */}
            <div className="mb-5 grid grid-cols-7 gap-1.5">
              {gridCells.map((cell, i) => {
                const dayData = cell ? mayData[cell - 1] : null
                return cell ? (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(cell)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-150 ${
                      cell === selectedDay
                        ? 'ring-2 ring-accent-blue shadow-lg shadow-accent-blue/20 bg-accent-blue/20 text-text-primary'
                        : `${intensityColors[dayData!.intensity]} text-text-secondary hover:ring-1 hover:ring-accent-blue/40`
                    }`}
                  >
                    {cell}
                  </button>
                ) : (
                  <div key={i} className="aspect-square" />
                )
              })}
            </div>
            {/* Heatmap Legend */}
            <div className="mb-5 flex items-center justify-between text-[11px] text-text-muted">
              <div className="flex items-center gap-3">
                {[
                  { label: '0-1h', color: intensityColors[0] },
                  { label: '1-2h', color: intensityColors[1] },
                  { label: '2-3h', color: intensityColors[2] },
                  { label: '3+h', color: intensityColors[3] },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className={`h-2.5 w-2.5 rounded-sm ${item.color}`} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span>Low</span>
                {[0.3, 0.5, 0.75, 1].map((opacity, i) => (
                  <div key={i} className="h-2 w-2 rounded-full bg-accent-blue" style={{ opacity }} />
                ))}
                <span>High</span>
              </div>
            </div>
            {/* Selected Day Panel */}
            <div className="mt-auto rounded-xl border border-border-card bg-surface p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium tracking-wider text-accent-blue">SELECTED DAY</p>
                  <p className="text-sm font-semibold text-text-primary">{day.dayName}, {day.date} May</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-accent-green/10 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
                  <span className="text-xs font-medium text-accent-green">Active</span>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-0.5 text-xs text-text-muted">Study</p>
                  <p className="text-lg font-bold text-accent-blue">{day.studyTime}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-text-muted">Breaks</p>
                  <p className="text-lg font-bold text-accent-amber">{day.breakTime}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-text-muted">Focus ratio</p>
                  <p className="text-lg font-bold text-accent-green">{day.focusRatio}</p>
                </div>
              </div>
              <p className="border-t border-border-card pt-3 text-xs text-text-muted">
                {day.sessionsCompleted} sessions completed · score {day.focusScore}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
