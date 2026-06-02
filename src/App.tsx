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

const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const calendarDays: (number | null)[] = [
  null, null, null, null, 1, 2, 3,
  4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31,
]

const heatmap: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 0, 5: 2, 6: 1, 7: 0,
  8: 3, 9: 4, 10: 3, 11: 2, 12: 1, 13: 0, 14: 1,
  15: 4, 16: 3, 17: 2, 18: 4, 19: 3, 20: 2, 21: 1,
  22: 4, 23: 3, 24: 4, 25: 3, 26: 2, 27: 4, 28: 4,
  29: 3, 30: 2, 31: 3,
}

const heatColors = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4']

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
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent-blue" />
              <h2 className="text-lg font-semibold">May 2026</h2>
            </div>
            {/* Calendar Grid */}
            <div className="mb-6">
              <div className="mb-1 grid grid-cols-7 gap-1">
                {dayHeaders.map((d) => (
                  <div key={d} className="py-1 text-center text-xs font-medium text-text-muted">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs ${
                      day === 31
                        ? 'ring-2 ring-accent-blue bg-accent-blue/20 text-text-primary font-semibold'
                        : day
                          ? `${heatColors[heatmap[day] ?? 0]} text-text-secondary`
                          : 'bg-transparent'
                    }`}
                  >
                    {day ?? ''}
                  </div>
                ))}
              </div>
            </div>
            {/* Heatmap Legend */}
            <div className="mb-6 flex items-center justify-end gap-2 text-[11px] text-text-muted">
              <span>Less</span>
              {heatColors.map((c, i) => (
                <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
              ))}
              <span>More</span>
            </div>
            {/* Selected Day Panel */}
            <div className="mt-auto rounded-xl border border-border-card bg-surface p-5">
              <p className="mb-3 text-sm font-medium text-accent-blue">SELECTED DAY: Sun, 31 May</p>
              <div className="mb-3 grid grid-cols-3 gap-4">
                {[
                  { label: 'Study', value: '8h 45m', accent: 'text-accent-blue' },
                  { label: 'Breaks', value: '1h 2m', accent: 'text-accent-amber' },
                  { label: 'Focus ratio', value: '89%', accent: 'text-accent-green' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xs text-text-muted">{s.label}</p>
                    <p className={`text-lg font-bold ${s.accent}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="border-t border-border-card pt-3 text-xs text-text-muted">
                16 of 17 sessions completed · score 94%
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
