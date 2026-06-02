import { useState, useEffect, useRef } from 'react'
import { Brain, BookOpen, Zap, Clock, BarChart3, Target, Flame, Calendar, Award, Coffee, Play, Pause, Check, CheckCircle, Plus, Settings, X, CloudRain, Radio, Keyboard } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useTasks, useHistory, useSettings, useTodayLog, useMonthLogs, useCategories, useCategoryBreakdown, useStreak, useXpLevel, useProductivityInsights, useCalendarHeatmapData, updateDailyReflection } from './db/hooks'
import { db } from './db/db'

let audioCtx: AudioContext | null = null

function playAlertSound(enabled: boolean) {
  if (!enabled) return
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime)
    osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.3)
  } catch {
    /* audio unavailable */
  }
}

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

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

function getIntensity(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes < 60) return 0
  if (minutes < 120) return 1
  if (minutes < 180) return 2
  return 3
}

const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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
    <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-[#0F172A]/70 backdrop-blur-md p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
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
  const { tasks: sessionTasks, addTask, toggleTask, incrementTaskPomodoro, isLoading: tasksLoading } = useTasks()
  const { history: sessionHistory, addEntry: addHistoryEntry, isLoading: historyLoading } = useHistory()
  const { dailyGoalMinutes, soundEnabled, updateSetting, targetSessionsPerCycle, longBreakDurationMinutes, ambientTrack, ambientVolume, isLoading: settingsLoading } = useSettings()
  const { studyMinutes: todayStudyMinutes, breakMinutes: todayBreakMinutes, incrementStudy, incrementBreak, isLoading: todayLogLoading } = useTodayLog()
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const { monthLogs, totalMonthHours, isLoading: monthLogsLoading } = useMonthLogs(currentMonth, currentYear)
  const { categories, isLoading: categoriesLoading, addCategory, deleteCategory } = useCategories()
  const { breakdown: categoryBreakdown, isLoading: breakdownLoading } = useCategoryBreakdown()
  const { currentStreak, isLoading: streakLoading } = useStreak()
  const { level, currentLevelXP, xpProgressPercent, isLoading: xpLoading } = useXpLevel()
  const { topSubject, avgMin, completionRate, peakDay, isLoading: insightsLoading } = useProductivityInsights()
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | number>('all')
  const { dayMinutesMap: categoryDayMinutes } = useCalendarHeatmapData(currentMonth, currentYear, calendarCategoryFilter)
  const [timerCategoryId, setTimerCategoryId] = useState<number | undefined>(undefined)

  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study')
  const [completedSessionsInCycle, setCompletedSessionsInCycle] = useState(0)
  const [isLongBreak, setIsLongBreak] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')
  const [localAmbientVolume, setLocalAmbientVolume] = useState(ambientVolume)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskPomodoroCount, setTaskPomodoroCount] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const completingRef = useRef(false)
  const incStudyRef = useRef(incrementStudy)
  const incBreakRef = useRef(incrementBreak)
  const ambientRef = useRef<{ ctx: AudioContext; masterGain: GainNode; stop: () => void } | null>(null)
  incStudyRef.current = incrementStudy
  incBreakRef.current = incrementBreak

  const handleModeSwitchRef = useRef(handleModeSwitch)
  handleModeSwitchRef.current = handleModeSwitch
  const completeSessionRef = useRef(completeSession)
  completeSessionRef.current = completeSession

  const isDataReady = !(tasksLoading || historyLoading || settingsLoading || todayLogLoading || monthLogsLoading || categoriesLoading || breakdownLoading || streakLoading || xpLoading || insightsLoading)

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const dynamicGridCells: (number | null)[] = [
    ...Array(firstDayIndex).fill(null),
    ...Array.from({ length: totalDaysInMonth }, (_, i) => i + 1),
  ]
  const isLiveMonth = currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()

  const monthLogMap = new Map(monthLogs.map(l => [parseInt(l.dateString.split('-')[2]), l]))

  const selectedDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
  const selectedDayLog = monthLogMap.get(selectedDay)
  const [draftNotes, setDraftNotes] = useState('')
  const [draftMood, setDraftMood] = useState('')
  const notesRef = useRef('')
  const moodRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const dbNotes = selectedDayLog?.notes ?? ''
    const dbMood = selectedDayLog?.mood ?? ''
    setDraftNotes(dbNotes)
    setDraftMood(dbMood)
    notesRef.current = dbNotes
    moodRef.current = dbMood
  }, [selectedDay, currentMonth, currentYear])

  const categoriesMap = new Map<number, { name: string; color: string }>()
  for (const c of categories) {
    if (c.id !== undefined) categoriesMap.set(c.id, { name: c.name, color: c.color })
  }

  const activeMonthData: DayData[] = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const date = i + 1
    const startDay = new Date(currentYear, currentMonth, date).getDay()
    const log = monthLogMap.get(date)
    const studyMin = categoryDayMinutes !== null
      ? (categoryDayMinutes.get(date) ?? 0)
      : (log?.studyMinutes ?? 0)
    const breakMin = log?.breakMinutes ?? 0
    const total = studyMin + breakMin
    const focusRatio = total > 0 ? Math.round((studyMin / total) * 100) : 0
    return {
      date,
      dayName: dayNames[startDay],
      studyTime: formatMinutes(studyMin),
      breakTime: formatMinutes(breakMin),
      focusRatio: `${focusRatio}%`,
      sessionsCompleted: '0',
      focusScore: `${Math.min(Math.round((studyMin / dailyGoalMinutes) * 100), 100)}%`,
      intensity: getIntensity(studyMin),
    }
  })

  const progress = dailyGoalMinutes > 0 ? Math.min(todayStudyMinutes / dailyGoalMinutes, 1) : 0
  const progressPercent = Math.round(progress * 100)
  const totalWeeklyBreakHours = parseFloat((todayBreakMinutes / 60).toFixed(1))
  const todaySessionsDone = sessionTasks.filter(t => t.completed).length
  const totalSessionsTarget = sessionTasks.length
  const sessionsRemaining = Math.max(totalSessionsTarget - todaySessionsDone, 0)

  const monthlyHistoryEntries = sessionHistory.filter(e => {
    const parts = e.timestamp.split(' ')
    if (parts.length < 3) return false
    const entryMonth = monthNames.indexOf(parts[0])
    const entryYear = parseInt(parts[2]) || new Date().getFullYear()
    return entryMonth === currentMonth && entryYear === currentYear
  })
  const totalMonthSessions = monthlyHistoryEntries.length + todaySessionsDone

  const isLastDay = selectedDay === totalDaysInMonth
  const liveDay = isLiveMonth && isLastDay
    ? {
        ...activeMonthData[selectedDay - 1],
        studyTime: formatMinutes(todayStudyMinutes),
        breakTime: formatMinutes(todayBreakMinutes),
        sessionsCompleted: `${todaySessionsDone} of ${totalSessionsTarget}`,
        focusScore: `${progressPercent}%`,
        intensity: getIntensity(todayStudyMinutes),
      }
    : activeMonthData[selectedDay - 1]

  const chartFocus = dailyGoalMinutes > 0 ? Math.min(Math.round((todayStudyMinutes / dailyGoalMinutes) * 100), 100) : 0

  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const y = d.getFullYear()
    const m = d.getMonth()
    const dayNum = d.getDate()
    if (m === currentMonth && y === currentYear) {
      const log = monthLogMap.get(dayNum)
      return log ? { studyMin: log.studyMinutes, breakMin: log.breakMinutes } : null
    }
    return null
  })

  const hasChartData = weekData.some(d => d !== null && d.studyMin > 0) || todayStudyMinutes > 0
  const chartData = hasChartData ? weekData.map((d, i) => ({
    day: dayNames[(monday.getDay() + i) % 7],
    hours: d ? parseFloat((d.studyMin / 60).toFixed(1)) : 0,
    focus: d ? Math.min(Math.round((d.studyMin / dailyGoalMinutes) * 100), 100) : 0,
  })) : []

  async function completeSession() {
    if (completingRef.current) return
    completingRef.current = true
    const elapsed = secondsElapsed
    const mode = timerMode
    setIsTimerActive(false)
    setSecondsElapsed(0)
    const now = new Date()
    const timestamp = `${monthNames[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    await addHistoryEntry({
      timestamp,
      type: mode,
      durationMinutes: Math.floor(elapsed / 60),
      categoryId: mode === 'study' ? timerCategoryId : undefined,
    })
    const firstUncompleted = sessionTasks.find(t => !t.completed)
    if (firstUncompleted && firstUncompleted.id !== undefined) {
      await toggleTask(firstUncompleted.id)
    } else {
      await addTask(`Session ${Date.now()}`)
      const allTasks = await db.tasks.orderBy('id').reverse().toArray()
      const justAdded = allTasks[0]
      if (justAdded?.id !== undefined) await toggleTask(justAdded.id)
    }
    playAlertSound(soundEnabled)
    if (mode === 'study' && activeTaskId !== null) {
      await incrementTaskPomodoro(activeTaskId)
    }
    completingRef.current = false

    if (mode === 'study') {
      const nextCount = completedSessionsInCycle + 1
      if (nextCount >= targetSessionsPerCycle) {
        setCompletedSessionsInCycle(0)
        setIsLongBreak(true)
        setTimerMode('break')
        setTimeout(() => playAlertSound(soundEnabled), 400)
      } else {
        setCompletedSessionsInCycle(nextCount)
        setIsLongBreak(false)
        setTimerMode('break')
      }
    } else {
      setTimerMode('study')
    }
  }

  function handleModeSwitch(mode: 'study' | 'break') {
    if (mode === timerMode) return
    if (mode === 'study') setIsLongBreak(false)
    if (isTimerActive) setIsTimerActive(false)
    setTimerMode(mode)
    playAlertSound(soundEnabled)
  }

  function handleAddTask(text: string, categoryId?: number, estimatedPomodoros?: number) {
    const trimmed = text.trim()
    if (!trimmed) return
    addTask(trimmed, categoryId, estimatedPomodoros ?? taskPomodoroCount)
  }

  function handleToggleTask(id: number) {
    const task = sessionTasks.find(t => t.id === id)
    if (task && !task.completed) playAlertSound(soundEnabled)
    toggleTask(id)
    if (activeTaskId === id) setActiveTaskId(null)
  }

  function handleNotesChange(value: string) {
    setDraftNotes(value)
    notesRef.current = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDailyReflection(selectedDateStr, notesRef.current, moodRef.current)
    }, 500)
  }

  function handleMoodSelect(mood: string) {
    const newMood = mood === draftMood ? '' : mood
    setDraftMood(newMood)
    moodRef.current = newMood
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    updateDailyReflection(selectedDateStr, notesRef.current, newMood)
  }

  function goPrevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else { setCurrentMonth(m => m - 1) }
  }

  function goNextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else { setCurrentMonth(m => m + 1) }
  }

  useEffect(() => {
    if (selectedDay > totalDaysInMonth) setSelectedDay(totalDaysInMonth)
  }, [currentMonth, currentYear, totalDaysInMonth, selectedDay])

  useEffect(() => {
    if (!isTimerActive) return
    const id = setInterval(() => {
      setSecondsElapsed(s => {
        const ns = s + 1
        if (ns % 60 === 0) {
          if (timerMode === 'study') {
            incStudyRef.current()
          } else {
            incBreakRef.current()
          }
        }
        return ns
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isTimerActive, timerMode])

  useEffect(() => {
    setLocalAmbientVolume(ambientVolume)
  }, [ambientVolume])

  function createAmbientTrack(ctx: AudioContext, track: string): { output: AudioNode; stop: () => void } | null {
    if (track === 'white-noise') {
      const bufSize = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.start()
      return { output: src, stop: () => { try { src.stop() } catch {} } }
    }
    if (track === 'rain') {
      const bufSize = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1
        d[i] = (lastOut + 0.02 * white) / 1.02
        lastOut = d[i]
        d[i] *= 3.5
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.start()
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 600
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.2
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.2
      lfo.connect(lfoGain)
      const ampGain = ctx.createGain()
      ampGain.gain.value = 0.48
      lfoGain.connect(ampGain.gain)
      lfo.start()
      src.connect(filter)
      filter.connect(ampGain)
      return { output: ampGain, stop: () => { try { src.stop(); lfo.stop() } catch {} } }
    }
    if (track === 'cafe') {
      const bufSize = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.start()
      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 900
      bandpass.Q.value = 0.4
      const gain = ctx.createGain()
      gain.gain.value = 0.25
      src.connect(bandpass)
      bandpass.connect(gain)
      return { output: gain, stop: () => { try { src.stop() } catch {} } }
    }
    return null
  }

  function startAmbient(track: string, volume: number) {
    if (ambientRef.current) {
      try { ambientRef.current.stop() } catch {}
      ambientRef.current = null
    }
    if (track === 'none') return
    const ctx = new AudioContext()
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)
    const result = createAmbientTrack(ctx, track)
    if (result) {
      result.output.connect(masterGain)
      const shouldPlay = timerMode === 'study' && isTimerActive
      masterGain.gain.value = shouldPlay ? volume : 0
      ambientRef.current = { ctx, masterGain, stop: () => { result.stop(); ctx.close() } }
    } else {
      ctx.close()
    }
  }

  function stopAmbient() {
    if (ambientRef.current) {
      try { ambientRef.current.stop() } catch {}
      ambientRef.current = null
    }
  }

  useEffect(() => {
    startAmbient(ambientTrack, localAmbientVolume)
    return () => stopAmbient()
  }, [ambientTrack])

  useEffect(() => {
    if (!ambientRef.current) return
    const shouldPlay = timerMode === 'study' && isTimerActive
    ambientRef.current.masterGain.gain.setValueAtTime(
      shouldPlay ? localAmbientVolume : 0,
      ambientRef.current.ctx.currentTime,
    )
  }, [timerMode, isTimerActive, localAmbientVolume])

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const key = e.key.toLowerCase()
      switch (key) {
        case ' ':
          e.preventDefault()
          setIsTimerActive(a => !a)
          break
        case 's':
          handleModeSwitchRef.current('study')
          break
        case 'b':
          handleModeSwitchRef.current('break')
          break
        case 'c':
          completeSessionRef.current()
          break
        case '?':
          setIsHotkeyHudOpen(o => !o)
          break
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  async function resetData() {
    stopAmbient()
    await db.tasks.clear()
    await db.history.clear()
    await db.daily_logs.clear()
    await db.settings.clear()
    await db.categories.clear()
    await db.settings.bulkAdd([
      { key: 'dailyGoalMinutes', value: 480 },
      { key: 'soundEnabled', value: true },
      { key: 'targetSessionsPerCycle', value: 4 },
      { key: 'longBreakDurationMinutes', value: 15 },
      { key: 'ambientTrack', value: 'none' },
      { key: 'ambientVolume', value: 0.5 },
    ])
    await db.categories.bulkAdd([
      { name: 'General', color: '#64748B' },
      { name: 'Development', color: '#3B82F6' },
      { name: 'Mathematics', color: '#8B5CF6' },
    ])
    setSecondsElapsed(0)
    setIsTimerActive(false)
    setTimerMode('study')
    setTimerCategoryId(undefined)
    setCompletedSessionsInCycle(0)
    setIsLongBreak(false)
    setLocalAmbientVolume(0.5)
    setActiveTaskId(null)
  }

  async function exportUserData() {
    const [tasks, history, dailyLogs, settings, categories] = await Promise.all([
      db.tasks.toArray(),
      db.history.toArray(),
      db.daily_logs.toArray(),
      db.settings.toArray(),
      db.categories.toArray(),
    ])
    const data = { version: 1, exportedAt: new Date().toISOString(), tasks, history, dailyLogs, settings, categories }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'study-dashboard-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importUserData(fileString: string) {
    try {
      const data = JSON.parse(fileString)
      if (!data || typeof data !== 'object') return
      if (Array.isArray(data.tasks)) {
        await db.tasks.clear()
        await db.tasks.bulkAdd(data.tasks)
      }
      if (Array.isArray(data.history)) {
        await db.history.clear()
        await db.history.bulkAdd(data.history)
      }
      if (Array.isArray(data.dailyLogs)) {
        await db.daily_logs.clear()
        await db.daily_logs.bulkAdd(data.dailyLogs)
      }
      if (Array.isArray(data.settings)) {
        await db.settings.clear()
        await db.settings.bulkAdd(data.settings)
      }
      if (Array.isArray(data.categories)) {
        await db.categories.clear()
        await db.categories.bulkAdd(data.categories)
      }
    } catch { /* malformed */ }
  }

  if (!isDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent" />
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface font-sans text-text-primary antialiased">
      <div className="w-full max-w-[1650px] min-h-screen mx-auto p-4 md:p-6 lg:p-8 flex flex-col justify-between">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full">

          {/* COLUMN 1: Focus Core Command Center */}
          <div className="flex flex-col gap-6">

          {/* CARD 1: Today's Progress */}
          <div className="relative overflow-hidden flex flex-col h-full rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-500/40 via-blue-500/40 to-transparent" />
            <div className="mb-5 flex items-center gap-2">
              <Target className="h-5 w-5 text-accent-blue" />
              <h2 className="text-sm font-semibold tracking-wide text-slate-200">Today's Progress</h2>
              <div className="ml-auto flex items-center gap-2 group relative">
                <span className="rounded-md bg-accent-purple/15 px-2 py-0.5 text-xs font-bold text-accent-purple">
                  Lv. {level}
                </span>
                <div className="w-20">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-accent-purple transition-all duration-300"
                      style={{ width: `${xpProgressPercent}%` }}
                    />
                  </div>
                </div>
                <div className="pointer-events-none absolute -top-8 right-0 z-10 whitespace-nowrap rounded-md border border-border-card bg-surface-card px-2 py-1 text-[11px] text-text-primary opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {currentLevelXP} / 1000 XP to next rank
                </div>
              </div>
            </div>
            <div className="flex flex-1 gap-8">
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
                      strokeDashoffset={String(314.16 * (1 - progress))}
                      filter="url(#glow)"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-text-primary">{formatMinutes(todayStudyMinutes)}</p>
                    <p className="text-xs text-slate-400">of {Math.round(dailyGoalMinutes / 60)}h goal</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-text-secondary">Study time</p>
                <div className="mt-3 flex w-full flex-col gap-1.5">
                  {[
                    { label: 'Focus', value: formatMinutes(todayStudyMinutes), valueClass: 'text-text-primary' },
                    { label: 'Break', value: formatMinutes(todayBreakMinutes), valueClass: 'text-text-primary' },
                    { label: 'Progress', value: `${progressPercent}%`, valueClass: 'text-accent-green' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between border-b border-border-subtle pb-1 last:border-0">
                      <span className="text-xs text-slate-400">{row.label}</span>
                      <span className={`text-xs font-semibold ${row.valueClass}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Right - Micro Cards */}
              <div className="flex flex-1 flex-col h-full gap-3">
                <MicroCard
                  icon={<Brain className="h-5 w-5 text-accent-purple" />}
                  label="Focus score"
                  value={`${chartFocus}%`}
                  badge={{ text: '+0% avg' }}
                  iconBg="bg-accent-purple/10"
                  badgeBg="bg-accent-purple/10"
                  badgeText="text-accent-purple"
                />
                <MicroCard
                  icon={<BookOpen className="h-5 w-5 text-accent-green" />}
                  label="Sessions done"
                  value={`${todaySessionsDone} of ${totalSessionsTarget}`}
                  badge={{ text: sessionsRemaining > 0 ? `${sessionsRemaining} left` : 'Completed!' }}
                  iconBg="bg-accent-green/10"
                  badgeBg={sessionsRemaining === 0 ? 'bg-accent-blue/10' : 'bg-accent-green/10'}
                  badgeText={sessionsRemaining === 0 ? 'text-accent-blue' : 'text-accent-green'}
                />
                <MicroCard
                  icon={<Zap className={`h-5 w-5 ${currentStreak > 0 ? 'text-accent-amber' : 'text-slate-400'}`} />}
                  label="Streak"
                  value={`${currentStreak} days`}
                  badge={currentStreak > 0 ? { text: 'Active', dot: true } : { text: 'Inactive' }}
                  iconBg={currentStreak > 0 ? 'bg-accent-amber/10' : 'bg-text-muted/10'}
                  badgeBg={currentStreak > 0 ? 'bg-accent-amber/10' : 'bg-text-muted/10'}
                  badgeText={currentStreak > 0 ? 'text-accent-amber' : 'text-slate-400'}
                />
                {/* Timer Controls */}
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                  isLongBreak && timerMode === 'break'
                    ? 'border-accent-green/50 bg-accent-green/5'
                    : 'border-border-subtle bg-surface/50'
                }`}>
                  <div className="flex overflow-hidden rounded-md border border-border-subtle">
                    <button
                      onClick={() => handleModeSwitch('study')}
                      className={`px-2.5 py-1 text-xs font-medium transition-all ${
                        timerMode === 'study'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'text-slate-400 hover:bg-surface hover:text-text-primary'
                      }`}
                    >
                      Study
                    </button>
                    <button
                      onClick={() => handleModeSwitch('break')}
                      className={`px-2.5 py-1 text-xs font-medium transition-all ${
                        timerMode === 'break'
                          ? isLongBreak ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'text-slate-400 hover:bg-surface hover:text-text-primary'
                      }`}
                    >
                      {isLongBreak && timerMode === 'break' ? 'Long Break' : 'Break'}
                    </button>
                  </div>
                  {timerMode === 'study' && (
                    <>
                      <select
                        value={timerCategoryId ?? ''}
                        onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                        className="max-w-[90px] rounded border border-border-subtle bg-surface px-1 py-0.5 text-[11px] text-text-primary outline-none"
                      >
                        <option value="">Subject</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <div className="h-5 w-px bg-border-subtle" />
                    </>
                  )}
                  {timerMode !== 'study' && <div className="h-5 w-px bg-border-subtle" />}
                  <span className={`min-w-[40px] text-xs font-medium tabular-nums ${
                    isLongBreak && timerMode === 'break' ? 'text-accent-green' : 'text-text-secondary'
                  }`}>
                    {String(Math.floor(secondsElapsed / 60)).padStart(2, '0')}:{String(secondsElapsed % 60).padStart(2, '0')}
                  </span>
                  {/* Cycle progress pips */}
                  <div className="flex items-center gap-1" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} sessions in current cycle`}>
                    {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-full transition-all duration-300 ${
                          i < completedSessionsInCycle
                            ? 'bg-accent-blue shadow-sm shadow-accent-blue/40'
                            : 'bg-border-subtle'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => setIsTimerActive(a => !a)}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue transition-all hover:bg-accent-blue/20 hover:shadow-md hover:shadow-accent-blue/20"
                  >
                    {isTimerActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  {(isTimerActive || secondsElapsed > 0) && (
                    <button
                      onClick={completeSession}
                      className="flex items-center gap-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 text-xs font-medium transition-all hover:bg-green-500/20"
                    >
                      <Check className="h-3 w-3" />
                      Complete
                    </button>
                  )}
                </div>
                {activeTaskId !== null && (() => {
                  const activeTask = sessionTasks.find(t => t.id === activeTaskId)
                  if (!activeTask || activeTask.completed) return null
                  return (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent-blue/20 bg-accent-blue/5 px-3 py-1.5 transition-all">
                      <span className="text-xs text-slate-400">Target:</span>
                      <span className="truncate text-xs font-medium text-accent-blue">{activeTask.text}</span>
                      <span className="ml-auto whitespace-nowrap text-[11px] text-slate-400">
                        🍅 {activeTask.actualPomodoros ?? 0}/{activeTask.estimatedPomodoros ?? 1}
                      </span>
                    </div>
                  )
                })()}
                {/* Task Planner */}
                <div className="flex flex-col flex-1 min-h-[200px] space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      data-task-input
                      type="text"
                      placeholder="Add a task..."
                      className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-400 outline-none focus:border-accent-blue/50"
                      onKeyDown={(e) => { if (e.key === 'Enter') { const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-pomodoros]'); handleAddTask((e.target as HTMLInputElement).value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); (e.target as HTMLInputElement).value = '' } }}
                    />
                    <select
                      data-task-category
                      className="w-24 rounded-lg border border-border-subtle bg-surface px-1.5 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue/50"
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <select
                      data-task-pomodoros
                      value={taskPomodoroCount}
                      onChange={e => setTaskPomodoroCount(Number(e.target.value))}
                      className="w-14 rounded-lg border border-border-subtle bg-surface px-1 py-1.5 text-xs text-text-primary outline-none focus:border-accent-blue/50"
                    >
                      {[1,2,3,4,5,6,7,8].map(n => (
                        <option key={n} value={n}>🍅{n}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => { const input = document.querySelector<HTMLInputElement>('[data-task-input]'); const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-pomodoros]'); if (input) { handleAddTask(input.value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); input.value = '' } }}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[100px] space-y-0.5">
                    {sessionTasks.length === 0 ? (
                      <p className="py-3 text-center text-xs italic text-slate-400">
                        No focus tasks planned for today. Add an objective above to get started!
                      </p>
                    ) : (
                      sessionTasks.map(task => (
                        <div
                          key={task.id}
                          onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
                            activeTaskId === task.id
                              ? 'bg-accent-blue/10 ring-1 ring-accent-blue/30'
                              : 'hover:bg-surface/50'
                          }`}
                        >
                          <div
                            onClick={e => { e.stopPropagation(); handleToggleTask(task.id!) }}
                            className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border ${
                              task.completed ? 'border-accent-blue bg-accent-blue/20' : 'border-border-subtle bg-surface'
                            }`}
                          >
                            {task.completed && <Check className="h-3 w-3 text-accent-blue" />}
                          </div>
                          {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: categoriesMap.get(task.categoryId)!.color }} />
                          )}
                          <span className={`flex-1 truncate text-xs ${task.completed ? 'text-slate-400 line-through' : 'text-text-primary'}`}>
                            {task.text}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            🍅 {task.actualPomodoros ?? 0}/{task.estimatedPomodoros ?? 1}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {/* Ambient Soundscape Mixer */}
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex overflow-hidden rounded-md border border-border-subtle">
                      {[
                        { id: 'none', icon: X, label: 'Off', activeClass: 'bg-surface text-text-primary', hoverClass: '' },
                        { id: 'rain', icon: CloudRain, label: 'Rain', activeClass: 'bg-accent-blue/15 text-accent-blue', hoverClass: '' },
                        { id: 'cafe', icon: Coffee, label: 'Cafe', activeClass: 'bg-accent-amber/15 text-accent-amber', hoverClass: '' },
                        { id: 'white-noise', icon: Radio, label: 'White', activeClass: 'bg-accent-purple/15 text-accent-purple', hoverClass: '' },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => updateSetting('ambientTrack', t.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-all ${
                            ambientTrack === t.id
                              ? t.activeClass
                              : 'text-slate-400 hover:bg-surface hover:text-text-primary'
                          }`}
                        >
                          <t.icon className="h-3 w-3" />
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={localAmbientVolume}
                        onChange={e => {
                          const v = parseFloat(e.target.value)
                          setLocalAmbientVolume(v)
                          updateSetting('ambientVolume', v)
                        }}
                        className="w-20 accent-[#3B82F6]"
                        title={`Volume: ${Math.round(localAmbientVolume * 100)}%`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Analytical Intelligence Hub */}
        <div className="flex flex-col gap-6">

          {/* CARD 2: Weekly Rhythm */}
          <div className="rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent-blue" />
              <h2 className="text-sm font-semibold tracking-wide text-slate-200">Weekly Rhythm</h2>
            </div>
            {/* Top Metrics Row */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              {[
                { label: 'Study time', value: `${totalMonthHours.toFixed(1)}h`, icon: <Clock className="h-3.5 w-3.5 text-accent-blue" /> },
                { label: 'Break time', value: `${totalWeeklyBreakHours}h`, icon: <Coffee className="h-3.5 w-3.5 text-accent-amber" /> },
                { label: 'Active days', value: `${new Set(monthLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString)).size}/${totalDaysInMonth}`, icon: <Calendar className="h-3.5 w-3.5 text-accent-green" /> },
                { label: 'Best day', value: '--', icon: <Award className="h-3.5 w-3.5 text-accent-purple" /> },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface/50 px-3 py-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface">
                    {m.icon}
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">{m.label}</p>
                    <p className="text-sm font-semibold">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border-subtle bg-surface/30 p-4">
                <p className="mb-3 text-xs font-medium text-text-secondary">Study hours trend</p>
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
                ) : (
                  <div className="flex h-[180px] items-center justify-center">
                    <p className="text-xs text-slate-400">No study data available for this week yet.</p>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border-subtle bg-surface/30 p-4">
                <p className="mb-3 text-xs font-medium text-text-secondary">Daily focus bars</p>
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
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
                ) : (
                  <div className="flex h-[180px] items-center justify-center">
                    <p className="text-xs text-slate-400">No study data available for this week yet.</p>
                  </div>
                )}
              </div>
            </div>
            {/* Productivity Insights */}
            <div className="rounded-xl border border-slate-800/40 bg-[#0F172A]/50 p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Productivity Insights</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'TOP SUBJECT', value: topSubject, icon: <Award className="h-3.5 w-3.5 text-accent-purple" />, valueClass: 'text-accent-purple' },
                  { label: 'AVG SESSION', value: `${avgMin} min`, icon: <Clock className="h-3.5 w-3.5 text-accent-blue" />, valueClass: 'text-accent-blue' },
                  { label: 'COMPLETION', value: `${completionRate}%`, icon: <CheckCircle className="h-3.5 w-3.5 text-accent-green" />, valueClass: 'text-accent-green' },
                  { label: 'PEAK DAY', value: peakDay, icon: <Calendar className="h-3.5 w-3.5 text-accent-amber" />, valueClass: 'text-accent-amber' },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border border-slate-800/60 bg-[#0F172A]/70 backdrop-blur-md p-3">
                    <div className="mb-2 flex items-center gap-2">
                      {m.icon}
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{m.label}</span>
                    </div>
                    <p className={`text-sm font-bold ${m.valueClass}`}>{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CARD 3: This Month */}
          <div className="rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5">
            <div className="mb-5 flex items-center gap-2">
              <Flame className="h-5 w-5 text-accent-amber" />
              <h2 className="text-sm font-semibold tracking-wide text-slate-200">This Month</h2>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setIsHotkeyHudOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-surface hover:text-text-primary"
                  title="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
                <button
                  onClick={resetData}
                  className="text-[11px] font-medium text-slate-400 transition-all hover:text-accent-blue hover:underline"
                >
                  Reset Data
                </button>
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-surface hover:text-text-primary"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-card">
              <div className="flex flex-col items-center px-4 first:pl-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                    <Clock className="h-5 w-5 text-accent-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Hours</p>
                    <p className="text-xl font-bold">{totalMonthHours.toFixed(1)}h</p>
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
                    <p className="text-xs text-slate-400">Sessions</p>
                    <p className="text-xl font-bold">{totalMonthSessions}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-1.5 rounded-sm ${i < Math.min(totalMonthSessions, 10) && totalMonthSessions > 0 ? 'bg-accent-purple/70' : 'bg-accent-purple/20'}`}
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
                    <p className="text-xs text-slate-400">Avg / Day</p>
                    <p className="text-xl font-bold">{(totalDaysInMonth > 0 ? (totalMonthHours / totalDaysInMonth).toFixed(1) : '0.0')}h</p>
                  </div>
                </div>
                <div className="mt-3 h-0.5 w-full max-w-[200px] rounded-full bg-accent-green/60" />
              </div>
            </div>
            {/* Category Breakdown */}
            <div className="mt-6 border-t border-border-subtle pt-5">
              <p className="mb-4 text-sm font-semibold text-text-primary">Category Hours</p>
              {categoryBreakdown.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="hours"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={55}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {categoryBreakdown.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-text-primary">{item.name}</span>
                        <span className="text-slate-400">{item.hours}h</span>
                        <span className="text-slate-400">({item.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-xs italic text-slate-400">
                  No category distributions recorded yet. Start a session to see your subject breakdown!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: Historical Ledger & Reflection Space */}
        <div className="flex flex-col gap-6">

          {/* CARD 4: Monthly Overview */}
          <div className="flex flex-col rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5">
            {/* Month Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent-blue" />
                <h2 className="text-sm font-semibold tracking-wide text-slate-200">{monthNames[currentMonth]} {currentYear}</h2>
              </div>
              <div className="flex items-center gap-1 text-slate-400">
                <button onClick={goPrevMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface hover:text-text-primary">‹</button>
                <span className="text-xs font-medium">{monthNames[currentMonth]} {currentYear}</span>
                <button onClick={goNextMonth} className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface hover:text-text-primary">›</button>
                <select
                  value={calendarCategoryFilter === 'all' ? 'all' : String(calendarCategoryFilter)}
                  onChange={e => setCalendarCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="ml-1 rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs text-text-secondary outline-none"
                >
                  <option value="all">All Subjects</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Day Labels */}
            <div className="mb-1.5 grid grid-cols-7 gap-1">
              {dayNames.map((d) => (
                <div key={d} className="py-1 text-center text-[11px] font-medium text-slate-400">{d}</div>
              ))}
            </div>
            {/* Calendar Grid */}
            <div className="mb-5 grid grid-cols-7 gap-1.5">
              {dynamicGridCells.map((cell, i) => {
                const dayData = cell ? activeMonthData[cell - 1] : null
                const isLiveDay = isLiveMonth && cell === totalDaysInMonth
                const intensity = isLiveDay ? getIntensity(todayStudyMinutes) : (dayData?.intensity ?? 0)
                return cell ? (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(cell)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-150 ${
                      cell === selectedDay
                        ? 'ring-2 ring-accent-blue shadow-lg shadow-accent-blue/20 bg-accent-blue/20 text-text-primary'
                        : `${intensityColors[intensity]} text-text-secondary hover:ring-1 hover:ring-accent-blue/40`
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
            <div className="mb-5 flex items-center justify-between text-[11px] text-slate-400">
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
                  <p className="text-sm font-semibold text-text-primary">{liveDay.dayName}, {selectedDay} {monthNames[currentMonth]}</p>
                </div>
                {isLiveMonth && selectedDay === totalDaysInMonth && (
                  <div className="flex items-center gap-1.5 rounded-full bg-accent-green/10 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent-green animate-pulse-soft" />
                    <span className="text-xs font-medium text-accent-green">Active</span>
                  </div>
                )}
              </div>
              <div className="mb-3 grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-0.5 text-xs text-slate-400">Study{calendarCategoryFilter !== 'all' ? ` (${categories.find(c => c.id === calendarCategoryFilter)?.name ?? 'Unknown'})` : ''}</p>
                  <p className="text-lg font-bold text-accent-blue">{liveDay.studyTime}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-slate-400">Breaks</p>
                  <p className="text-lg font-bold text-accent-amber">{liveDay.breakTime}</p>
                </div>
                <div>
                  <p className="mb-0.5 text-xs text-slate-400">Focus ratio</p>
                  <p className="text-lg font-bold text-accent-green">{liveDay.focusRatio}</p>
                </div>
              </div>
              <p className="border-t border-border-card pt-3 text-xs text-slate-400">
                {liveDay.sessionsCompleted} sessions completed · score {liveDay.focusScore}
              </p>
              {/* Mood Selector */}
              <div className="mt-4 flex gap-2">
                {[
                  { label: 'Focused', emoji: '🧠', value: 'focused' },
                  { label: 'Energetic', emoji: '⚡', value: 'energetic' },
                  { label: 'Tired', emoji: '🥱', value: 'tired' },
                  { label: 'Distracted', emoji: '🌪️', value: 'distracted' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => handleMoodSelect(m.value)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                      draftMood === m.value
                        ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                        : 'border-border-subtle bg-surface/50 text-slate-400 hover:border-blue-500/30 hover:text-text-primary'
                    }`}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              {/* Reflection Textarea */}
              <textarea
                value={draftNotes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Write a brief reflection on your focus, hurdles, or wins for this day..."
                rows={3}
                className="mt-3 w-full resize-none rounded-lg border border-border-subtle bg-surface/50 px-3 py-2 text-xs text-text-primary placeholder:text-slate-400 outline-none focus:border-accent-blue/50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsSettingsOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md rounded-xl border border-slate-800/60 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-surface hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-6">
              <p className="mb-1 text-sm font-medium text-text-primary">Daily Goal</p>
              <p className="mb-3 text-xs text-slate-400">{Math.round(dailyGoalMinutes / 60)} hours</p>
              <input type="range" min="120" max="720" step="60" value={dailyGoalMinutes} onChange={e => updateSetting('dailyGoalMinutes', Number(e.target.value))} className="w-full accent-[#3B82F6]" />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>2h</span><span>12h</span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface/50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">Sound Effects</p>
                <p className="text-xs text-slate-400">Play chime on session events</p>
              </div>
              <button onClick={() => updateSetting('soundEnabled', !soundEnabled)} className={`relative h-6 w-11 rounded-full transition-colors ${soundEnabled ? 'bg-accent-blue' : 'bg-border-subtle'}`}>
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
              <div className="relative flex justify-center"><span className="bg-surface-card px-2 text-[11px] font-medium tracking-wider text-slate-400">POMODORO CYCLE</span></div>
            </div>
            <div className="mb-3">
              <p className="mb-1 text-sm font-medium text-text-primary">Sessions per Cycle</p>
              <p className="mb-2 text-xs text-slate-400">{targetSessionsPerCycle} sessions → Long Break</p>
              <input type="range" min="2" max="6" step="1" value={targetSessionsPerCycle} onChange={e => updateSetting('targetSessionsPerCycle', Number(e.target.value))} className="w-full accent-[#3B82F6]" />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>2</span><span>6</span></div>
            </div>
            <div className="mb-6">
              <p className="mb-1 text-sm font-medium text-text-primary">Long Break Duration</p>
              <p className="mb-2 text-xs text-slate-400">{longBreakDurationMinutes} minutes</p>
              <input type="range" min="10" max="30" step="5" value={longBreakDurationMinutes} onChange={e => updateSetting('longBreakDurationMinutes', Number(e.target.value))} className="w-full accent-[#3B82F6]" />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>10m</span><span>30m</span></div>
            </div>
            <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onload = () => importUserData(r.result as string); r.readAsText(file) }; e.target.value = '' }} />
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
              <div className="relative flex justify-center"><span className="bg-surface-card px-2 text-[11px] font-medium tracking-wider text-slate-400">DATA MANAGEMENT</span></div>
            </div>
            <div className="mb-6 flex gap-3">
              <button onClick={exportUserData} className="flex-1 rounded-lg border border-accent-blue/30 bg-accent-blue/5 px-3 py-2 text-xs font-medium text-accent-blue transition-all hover:bg-accent-blue/10">Export Backup</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-lg border border-accent-purple/30 bg-accent-purple/5 px-3 py-2 text-xs font-medium text-accent-purple transition-all hover:bg-accent-purple/10">Import Backup</button>
            </div>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
              <div className="relative flex justify-center"><span className="bg-surface-card px-2 text-[11px] font-medium tracking-wider text-slate-400">MANAGE SUBJECT CATEGORIES</span></div>
            </div>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (!newCategoryName.trim()) return;
                      addCategory(newCategoryName.trim(), newCategoryColor);
                      setNewCategoryName('');
                    }
                  }}
                  placeholder="e.g. Science, History..."
                  className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-400 outline-none focus:border-accent-blue/50"
                />
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={e => setNewCategoryColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-md border border-border-subtle bg-surface p-0.5"
                />
                <button
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    addCategory(newCategoryName.trim(), newCategoryColor);
                    setNewCategoryName('');
                  }}
                  className="rounded-lg bg-accent-blue/10 px-3 py-1.5 text-xs font-medium text-accent-blue transition-all hover:bg-accent-blue/20"
                >
                  Add
                </button>
              </div>
              <div className="mt-3 max-h-24 space-y-1 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="py-2 text-center text-[11px] italic text-slate-400">No categories yet.</p>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-2 rounded-md bg-surface/50 px-3 py-1.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-xs text-text-primary">{cat.name}</span>
                      <button
                        onClick={() => deleteCategory(cat.id!)}
                        className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border-subtle" /></div>
              <div className="relative flex justify-center"><span className="bg-surface-card px-2 text-[11px] font-medium tracking-wider text-slate-400">RECENT ACTIVITY LOG</span></div>
            </div>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {sessionHistory.length === 0 ? (
                <p className="py-2 text-center text-xs italic text-slate-400">No recent sessions completed today.</p>
              ) : (
                sessionHistory.slice(0, 5).map(entry => (
                  <div key={entry.id} className="flex items-center justify-between rounded-md bg-surface/50 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${entry.type === 'study' ? 'bg-accent-blue' : 'bg-accent-amber'}`} />
                      <span className="text-xs text-text-primary">{entry.type === 'study' ? 'Study' : 'Break'}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{entry.timestamp} · {entry.durationMinutes}m</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {isHotkeyHudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsHotkeyHudOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-xl border border-slate-800/60 bg-[#0F172A]/70 backdrop-blur-md shadow-xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button onClick={() => setIsHotkeyHudOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-surface hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { keys: 'Space', action: 'Toggle play / pause' },
                { keys: 'S', action: 'Switch to Study mode' },
                { keys: 'B', action: 'Switch to Break mode' },
                { keys: 'C', action: 'Complete current session' },
                { keys: '?', action: 'Toggle this shortcut panel' },
              ].map(item => (
                <div key={item.keys} className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface/50 px-4 py-3">
                  <span className="text-sm text-text-primary">{item.action}</span>
                  <kbd className="rounded border border-border-subtle bg-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase shadow-sm">{item.keys}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">Shortcuts are disabled while typing in input fields.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
