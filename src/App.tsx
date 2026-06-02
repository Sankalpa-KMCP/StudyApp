import { useState, useEffect, useRef, useMemo } from 'react'
import { Brain, BookOpen, Zap, Clock, BarChart3, Target, Flame, Calendar, Award, Coffee, Play, Pause, Check, CheckCircle, Plus, Settings, X, CloudRain, Radio, Keyboard, ArrowLeft, Trash2, Sliders, Volume2, Database, Sparkles, ChevronLeft } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTasks, useHistory, useSettings, useTodayLog, useCategories, updateDailyReflection, calculateStreak, calculateXpLevel, calculateProductivityInsights, calculateCategoryBreakdown, calculateMonthLogs, calculateCalendarHeatmapData, calculateSM2 } from './db/hooks'
import { db } from './db/db'
import type { TaskItem, SettingsKey } from './db/types'

const THEME_PROFILES: Record<string, {
  surface: string
  surfaceCard: string
  surfaceCardRgb: string
  accentBlue: string
  accentPurple: string
  accentGreen: string
  accentAmber: string
}> = {
  'midnight-slate': {
    surface: '#0B0F19',
    surfaceCard: '#131926',
    surfaceCardRgb: '19, 25, 38',
    accentBlue: '#3B82F6',
    accentPurple: '#8B5CF6',
    accentGreen: '#10B981',
    accentAmber: '#F59E0B',
  },
  'cyber-amethyst': {
    surface: '#12071F',
    surfaceCard: '#1C0D2E',
    surfaceCardRgb: '28, 13, 46',
    accentBlue: '#C084FC',
    accentPurple: '#A855F7',
    accentGreen: '#F472B6',
    accentAmber: '#FB7185',
  },
  'deep-forest': {
    surface: '#050F0B',
    surfaceCard: '#0C1C16',
    surfaceCardRgb: '12, 28, 22',
    accentBlue: '#10B981',
    accentPurple: '#34D399',
    accentGreen: '#059669',
    accentAmber: '#F59E0B',
  },
  'ocean-trench': {
    surface: '#000000',
    surfaceCard: '#0A0F1D',
    surfaceCardRgb: '10, 15, 29',
    accentBlue: '#06B6D4',
    accentPurple: '#0891B2',
    accentGreen: '#22D3EE',
    accentAmber: '#E0F2FE',
  }
}

let audioCtx: AudioContext | null = null

function playTibetanBowl(enabled: boolean) {
  if (!enabled) return
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime
    const f0 = 180
    const frequencies = [f0, f0 * 2.76, f0 * 5.4, f0 * 8.93]
    const releaseTime = 4.5

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.25, now)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime)
    masterGain.connect(ctx.destination)

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const oscGain = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      
      const volume = idx === 0 ? 0.35 : idx === 1 ? 0.28 : idx === 2 ? 0.22 : 0.15
      oscGain.gain.setValueAtTime(volume, now)
      
      osc.connect(oscGain)
      oscGain.connect(masterGain)
      
      osc.start(now)
      osc.stop(now + releaseTime)
    })
  } catch {
    /* audio unavailable */
  }
}

function playTactileThock() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    const now = ctx.currentTime
    const duration = 0.005
    const sampleRate = ctx.sampleRate
    const bufferSize = Math.max(1, Math.floor(sampleRate * duration))
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
    const data = buffer.getChannelData(0)
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      b6 = white * 0.115926
      data[i] = pink * 0.11
    }
    
    const noiseNode = ctx.createBufferSource()
    noiseNode.buffer = buffer
    
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(380, now)
    filter.Q.setValueAtTime(6.0, now)
    
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.4, now)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    
    noiseNode.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    noiseNode.start(now)
    noiseNode.onended = () => {
      try {
        noiseNode.disconnect()
        filter.disconnect()
        gainNode.disconnect()
      } catch {}
    }
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
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-950/65 hover:border-slate-700/80 p-4 transition-all duration-300 hover:scale-[1.01] group cursor-default">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105 ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-base font-semibold text-text-primary">{value}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-300 ${badgeBg}`}>
        {badge.dot && <span className="h-1.5 w-1.5 rounded-full bg-accent-amber animate-pulse-soft" />}
        <span className={`text-xs font-medium ${badgeText}`}>{badge.text}</span>
      </div>
    </div>
  )
}

function App() {
  const { tasks: sessionTasks, addTask, toggleTask, incrementTaskCycle, isLoading: tasksLoading } = useTasks()
  const { history: sessionHistory, addEntry: addHistoryEntry, isLoading: historyLoading } = useHistory()
  const {
    dailyGoalMinutes,
    soundEnabled,
    updateSetting,
    targetSessionsPerCycle,
    longBreakDurationMinutes,
    ambientVolume_rain,
    ambientVolume_cafe,
    ambientVolume_whiteNoise,
    theme,
    cardOpacity,
    backdropBlur,
    audio_presets,
    shortBreakDurationMinutes,
    ambient_alphaWaves,
    tactile_feedback,
    developer_font,
    enforce_lockout,
    isLoading: settingsLoading
  } = useSettings()
  const { studyMinutes: todayStudyMinutes, breakMinutes: todayBreakMinutes, incrementStudy, incrementBreak, isLoading: todayLogLoading } = useTodayLog()
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const { categories, isLoading: categoriesLoading, addCategory, deleteCategory } = useCategories()
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | number>('all')

  // Consolidated Single Table subscription for daily_logs
  const allLogs = useLiveQuery(() => db.daily_logs.toArray())
  const allLogsLoading = allLogs === undefined

  // Pure selector derivations using useMemo to eliminate observer thrashing
  const monthLogsData = useMemo(() => {
    return calculateMonthLogs(allLogs ?? [], currentMonth, currentYear)
  }, [allLogs, currentMonth, currentYear])
  const monthLogs = monthLogsData.monthLogs
  const totalMonthHours = monthLogsData.totalMonthHours

  const breakdownData = useMemo(() => {
    return calculateCategoryBreakdown(sessionHistory ?? [], categories ?? [])
  }, [sessionHistory, categories])
  const categoryBreakdown = breakdownData.breakdown

  const currentStreak = useMemo(() => {
    return calculateStreak(allLogs ?? [])
  }, [allLogs])

  const xpData = useMemo(() => {
    return calculateXpLevel(allLogs ?? [])
  }, [allLogs])
  const level = xpData.level
  const currentLevelXP = xpData.currentLevelXP
  const xpProgressPercent = xpData.xpProgressPercent

  const insights = useMemo(() => {
    return calculateProductivityInsights(sessionHistory ?? [], sessionTasks ?? [], allLogs ?? [], categories ?? [])
  }, [sessionHistory, sessionTasks, allLogs, categories])
  const { topSubject, avgMin, completionRate, peakDay } = insights

  const categoryDayMinutes = useMemo(() => {
    return calculateCalendarHeatmapData(sessionHistory ?? [], currentMonth, calendarCategoryFilter)
  }, [sessionHistory, currentMonth, calendarCategoryFilter])
  const [timerCategoryId, setTimerCategoryId] = useState<number | undefined>(undefined)

  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [timerMode, setTimerMode] = useState<'study' | 'break'>('study')
  const [completedSessionsInCycle, setCompletedSessionsInCycle] = useState(0)
  const [isLongBreak, setIsLongBreak] = useState(false)

  const targetSeconds = useMemo(() => {
    if (timerMode === 'study') {
      return 25 * 60 // 25 minutes for study
    } else {
      const dur = isLongBreak ? longBreakDurationMinutes : shortBreakDurationMinutes
      return dur * 60
    }
  }, [timerMode, isLongBreak, longBreakDurationMinutes, shortBreakDurationMinutes])

  const remainingSeconds = Math.max(0, targetSeconds - secondsElapsed)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')

  // Multi-Channel Volumes
  const [localVolumeRain, setLocalVolumeRain] = useState(0.5)
  const [localVolumeCafe, setLocalVolumeCafe] = useState(0.5)
  const [localVolumeWhiteNoise, setLocalVolumeWhiteNoise] = useState(0.5)
  const [localAlphaWaves, setLocalAlphaWaves] = useState(false)

  // Zen Mode, Active View Router & Backups Drag/Drop
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeView, setActiveView] = useState<'dashboard' | 'settings'>('dashboard')
  const [settingsTab, setSettingsTab] = useState<'visual' | 'audio' | 'metrics' | 'vault'>('visual')
  const [isDragging, setIsDragging] = useState(false)

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskCycleCount, setTaskCycleCount] = useState(1)
  const [localTactileFeedback, setLocalTactileFeedback] = useState(false)
  const [activeToast, setActiveToast] = useState<{ key: string; message: string; id: number } | null>(null)
  const [localDeveloperFont, setLocalDeveloperFont] = useState('JetBrains Mono')
  const [localEnforceLockout, setLocalEnforceLockout] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const volRainRef = useRef(localVolumeRain)
  const volCafeRef = useRef(localVolumeCafe)
  const volWhiteNoiseRef = useRef(localVolumeWhiteNoise)
  const alphaWavesRef = useRef(localAlphaWaves)
  const waveAmplitudeRef = useRef(0)

  volRainRef.current = localVolumeRain
  volCafeRef.current = localVolumeCafe
  volWhiteNoiseRef.current = localVolumeWhiteNoise
  alphaWavesRef.current = localAlphaWaves

  const completingRef = useRef(false)
  const incStudyRef = useRef(incrementStudy)
  const incBreakRef = useRef(incrementBreak)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const channelsRef = useRef<{
    [key: string]: {
      source: AudioNode | null
      gainNode: GainNode | null
      stop: (() => void) | null
    }
  }>({
    rain: { source: null, gainNode: null, stop: null },
    cafe: { source: null, gainNode: null, stop: null },
    whiteNoise: { source: null, gainNode: null, stop: null },
    alphaWaves: { source: null, gainNode: null, stop: null }
  })

  incStudyRef.current = incrementStudy
  incBreakRef.current = incrementBreak

  const handleModeSwitchRef = useRef(handleModeSwitch)
  handleModeSwitchRef.current = handleModeSwitch
  const completeSessionRef = useRef(completeSession)
  completeSessionRef.current = completeSession

  const isDataReady = !(tasksLoading || historyLoading || settingsLoading || todayLogLoading || allLogsLoading || categoriesLoading)

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

  const monthlyHistoryEntries = useMemo(() => {
    return sessionHistory
      .filter(e => {
        const parts = e.timestamp.split(' ')
        if (parts.length < 3) return false
        const entryMonth = monthNames.indexOf(parts[0])
        const entryYear = parseInt(parts[2]) || new Date().getFullYear()
        return entryMonth === currentMonth && entryYear === currentYear
      })
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  }, [sessionHistory, currentMonth, currentYear])
  const totalMonthSessions = monthlyHistoryEntries.length + todaySessionsDone

  const selectedDayHistory = useMemo(() => {
    return sessionHistory
      .filter(e => {
        const parts = e.timestamp.split(' ')
        if (parts.length < 2) return false
        const entryMonth = monthNames.indexOf(parts[0])
        const entryDay = parseInt(parts[1])
        return entryMonth === currentMonth && entryDay === selectedDay
      })
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
  }, [sessionHistory, currentMonth, selectedDay])


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
    playTibetanBowl(soundEnabled)
    if (mode === 'study') {
      const studySessionCount = parseInt(localStorage.getItem('completed_study_sessions_count') || '0') + 1
      localStorage.setItem('completed_study_sessions_count', String(studySessionCount))
      if (studySessionCount % 5 === 0) {
        await createDatabaseSnapshot()
      }
      if (activeTaskId !== null) {
        await incrementTaskCycle(activeTaskId)
      }
    }
    completingRef.current = false

    if (mode === 'study') {
      const nextCount = completedSessionsInCycle + 1
      if (nextCount >= targetSessionsPerCycle) {
        setCompletedSessionsInCycle(0)
        setIsLongBreak(true)
        setTimerMode('break')
        setTimeout(() => playTibetanBowl(soundEnabled), 400)
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
    if (completingRef.current) return
    if (mode === timerMode) return
    if (mode === 'study') setIsLongBreak(false)
    if (isTimerActive) setIsTimerActive(false)
    setSecondsElapsed(0)
    setTimerMode(mode)
    playTibetanBowl(soundEnabled)
  }

  function handleAddTask(text: string, categoryId?: number, estimatedCycles?: number) {
    const trimmed = text.trim()
    if (!trimmed) return
    addTask(trimmed, categoryId, estimatedCycles ?? taskCycleCount)
  }

  async function handleToggleTask(id: number) {
    const task = sessionTasks.find(t => t.id === id)
    if (task) {
      if (!task.completed) {
        playTibetanBowl(soundEnabled)
        await toggleTask(id)
      } else {
        await db.tasks.update(id, { completed: false, nextReviewDate: undefined })
      }
    }
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

  // Auto-complete focus/break cycle when seconds elapsed reaches target seconds
  useEffect(() => {
    if (isTimerActive && secondsElapsed >= targetSeconds) {
      completeSessionRef.current()
    }
  }, [secondsElapsed, targetSeconds, isTimerActive])

  // Zen V3 Particle Engine: Runs inside requestAnimationFrame, scales speed and connection alpha with aggregate ambient volumes
  useEffect(() => {
    if (!isZenMode) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = canvas.width = window.innerWidth
    let height = canvas.height = window.innerHeight

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Setup 60 particles
    const particleCount = 60
    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      originalVx: number
      originalVy: number
    }
    const particles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 0.4 + 0.15
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      particles.push({
        x,
        y,
        vx,
        vy,
        radius: Math.random() * 1.8 + 0.8,
        originalVx: vx,
        originalVy: vy
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Query volume refs dynamically
      const volRain = volRainRef.current
      const volCafe = volCafeRef.current
      const volWhiteNoise = volWhiteNoiseRef.current
      const alphaWaves = alphaWavesRef.current ? 0.35 : 0
      const aggregateVol = volRain + volCafe + volWhiteNoise + alphaWaves

      const isMuted = aggregateVol <= 0.01

      // Speeds scale directly with sound volume levels
      const speedFactor = isMuted ? 0 : Math.min(2.5, aggregateVol * 1.3)
      const maxDistance = isMuted ? 40 : 100 + Math.min(50, aggregateVol * 30)
      const maxLineAlpha = isMuted ? 0 : Math.min(0.20, aggregateVol * 0.12)

      particles.forEach(p => {
        if (isMuted) {
          // Collapse to static central cluster when muted
          const targetX = width / 2
          const targetY = height / 2
          p.x += (targetX - p.x) * 0.015
          p.y += (targetY - p.y) * 0.015
        } else {
          p.x += p.originalVx * speedFactor
          p.y += p.originalVy * speedFactor

          // Wrap around or bounce within edges
          if (p.x < 0) { p.x = 0; p.originalVx *= -1 }
          else if (p.x > width) { p.x = width; p.originalVx *= -1 }

          if (p.y < 0) { p.y = 0; p.originalVy *= -1 }
          else if (p.y > height) { p.y = height; p.originalVy *= -1 }
        }

        // Draw node
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = isMuted
          ? 'rgba(71, 85, 105, 0.3)'
          : `rgba(99, 102, 241, ${0.35 + Math.min(0.35, aggregateVol * 0.15)})`
        ctx.fill()
      })

      // Draw connection lines if not muted
      if (!isMuted) {
        for (let i = 0; i < particleCount; i++) {
          for (let j = i + 1; j < particleCount; j++) {
            const p1 = particles[i]
            const p2 = particles[j]
            const dx = p1.x - p2.x
            const dy = p1.y - p2.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist < maxDistance) {
              const alpha = (1 - dist / maxDistance) * maxLineAlpha
              ctx.beginPath()
              ctx.moveTo(p1.x, p1.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`
              ctx.lineWidth = 0.75
              ctx.stroke()
            }
          }
        }
      }

      // --- Audio-Reactive Sine Wave Ribbon ---
      const waveBaseY = height - 2
      const targetAmp = isMuted ? 0 : Math.min(40, aggregateVol * 30)
      waveAmplitudeRef.current += (targetAmp - waveAmplitudeRef.current) * 0.035

      if (waveAmplitudeRef.current > 0.5) {
        const waveTime = performance.now() * 0.001
        const layers = [
          { freq: 0.008, speed: 0.8, phase: 0,          color: 'rgba(168, 85, 247, 0.2)',  lineW: 2.0 },
          { freq: 0.012, speed: 1.2, phase: Math.PI / 3, color: 'rgba(59, 130, 246, 0.1)',  lineW: 1.5 },
          { freq: 0.006, speed: -0.6, phase: Math.PI / 1.5, color: 'rgba(139, 92, 246, 0.15)', lineW: 1.0 },
        ]
        layers.forEach(l => {
          ctx.beginPath()
          ctx.moveTo(0, waveBaseY)
          const freq = l.freq * (1 + aggregateVol * 0.3)
          const amp = waveAmplitudeRef.current * (1 - layers.indexOf(l) * 0.15)
          for (let x = 0; x <= width; x += 3) {
            ctx.lineTo(x, waveBaseY + Math.sin(x * freq + waveTime * l.speed + l.phase) * amp)
          }
          ctx.strokeStyle = l.color
          ctx.lineWidth = l.lineW
          ctx.stroke()
        })
      } else {
        ctx.beginPath()
        ctx.moveTo(0, waveBaseY)
        ctx.lineTo(width, waveBaseY)
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [isZenMode])

  // active recall helper
  async function submitRecallGrade(task: TaskItem, q: number) {
    if (task.id === undefined) return
    const { repetitionCount, easinessFactor, intervalDays } = calculateSM2(
      q,
      task.repetitionCount ?? 0,
      task.easinessFactor ?? 2.5,
      task.intervalDays ?? 0
    )

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)
    const nextReviewDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

    await db.tasks.update(task.id, {
      repetitionCount,
      easinessFactor,
      intervalDays,
      nextReviewDate,
      completed: true
    })
  }

  // snapshot helpers
  async function createDatabaseSnapshot() {
    try {
      const [tasks, history, dailyLogs, settings, categories] = await Promise.all([
        db.tasks.toArray(),
        db.history.toArray(),
        db.daily_logs.toArray(),
        db.settings.toArray(),
        db.categories.toArray(),
      ])
      const snapshot = {
        timestamp: new Date().toISOString(),
        tasks,
        history,
        dailyLogs,
        settings,
        categories
      }
      const existingStr = localStorage.getItem('study_dashboard_snapshots')
      const snapshots = existingStr ? JSON.parse(existingStr) : []
      snapshots.unshift(snapshot)
      if (snapshots.length > 3) {
        snapshots.pop()
      }
      localStorage.setItem('study_dashboard_snapshots', JSON.stringify(snapshots))
      console.log('Saved local storage emergency backup snapshot successfully.')
    } catch (err) {
      console.error('Failed to create database snapshot:', err)
    }
  }

  async function exportStudyBackup() {
    try {
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
      a.download = `study-vault-${new Date().toISOString().slice(0, 10)}.studybackup`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  async function importStudyBackup(fileString: string) {
    try {
      const data = JSON.parse(fileString)
      if (!data || typeof data !== 'object') return

      localStorage.removeItem('study_dashboard_snapshots')
      localStorage.removeItem('completed_study_sessions_count')

      await Promise.all([
        db.tasks.clear(),
        db.history.clear(),
        db.daily_logs.clear(),
        db.settings.clear(),
        db.categories.clear(),
      ])

      if (Array.isArray(data.tasks)) await db.tasks.bulkAdd(data.tasks)
      if (Array.isArray(data.history)) await db.history.bulkAdd(data.history)
      if (Array.isArray(data.dailyLogs)) await db.daily_logs.bulkAdd(data.dailyLogs)
      if (Array.isArray(data.settings)) await db.settings.bulkAdd(data.settings)
      if (Array.isArray(data.categories)) await db.categories.bulkAdd(data.categories)

      console.log('Vault backup imported successfully. Reloading page...')
      window.location.reload()
    } catch (err) {
      alert('Failed to import vault: Malformed backup file.')
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      const r = new FileReader()
      r.onload = () => {
        if (typeof r.result === 'string') {
          importStudyBackup(r.result)
        }
      }
      r.readAsText(file)
    }
  }

  // Auto-restore effect
  useEffect(() => {
    if (!isDataReady) return
    const autoRestoreIfEmpty = async () => {
      const [tasksCount, categoriesCount, settingsCount] = await Promise.all([
        db.tasks.count(),
        db.categories.count(),
        db.settings.count()
      ])
      if (tasksCount === 0 && categoriesCount === 0 && settingsCount === 0) {
        const existingStr = localStorage.getItem('study_dashboard_snapshots')
        if (existingStr) {
          try {
            const snapshots = JSON.parse(existingStr)
            if (Array.isArray(snapshots) && snapshots.length > 0) {
              const latest = snapshots[0]
              console.log('IndexedDB is empty. Auto-restoring from latest localStorage snapshot...', latest.timestamp)
              if (Array.isArray(latest.tasks)) await db.tasks.bulkAdd(latest.tasks)
              if (Array.isArray(latest.history)) await db.history.bulkAdd(latest.history)
              if (Array.isArray(latest.dailyLogs)) await db.daily_logs.bulkAdd(latest.dailyLogs)
              if (Array.isArray(latest.settings)) await db.settings.bulkAdd(latest.settings)
              if (Array.isArray(latest.categories)) await db.categories.bulkAdd(latest.categories)
              window.location.reload()
            }
          } catch (err) {
            console.error('Auto-restore failed:', err)
          }
        }
      }
    }
    autoRestoreIfEmpty()
  }, [isDataReady])

  useEffect(() => {
    if (ambientVolume_rain !== undefined) setLocalVolumeRain(ambientVolume_rain)
  }, [ambientVolume_rain])

  useEffect(() => {
    if (ambientVolume_cafe !== undefined) setLocalVolumeCafe(ambientVolume_cafe)
  }, [ambientVolume_cafe])

  useEffect(() => {
    if (ambientVolume_whiteNoise !== undefined) setLocalVolumeWhiteNoise(ambientVolume_whiteNoise)
  }, [ambientVolume_whiteNoise])

  useEffect(() => {
    if (ambient_alphaWaves !== undefined) setLocalAlphaWaves(ambient_alphaWaves)
  }, [ambient_alphaWaves])

  useEffect(() => {
    if (tactile_feedback !== undefined) setLocalTactileFeedback(tactile_feedback)
  }, [tactile_feedback])

  useEffect(() => {
    if (developer_font !== undefined) setLocalDeveloperFont(developer_font)
  }, [developer_font])

  useEffect(() => {
    if (enforce_lockout !== undefined) setLocalEnforceLockout(enforce_lockout)
  }, [enforce_lockout])

  // Tab Destruction Protection: sessionStorage backing shadow state
  useEffect(() => {
    if (!isDataReady) return
    const shadow = {
      mode: timerMode,
      secondsElapsed,
      isTimerActive,
      categoryId: timerCategoryId,
      timestamp: Date.now()
    }
    sessionStorage.setItem('active_session_shadow', JSON.stringify(shadow))
  }, [timerMode, secondsElapsed, isTimerActive, timerCategoryId, isDataReady])

  // Boot restore logic for interrupted active session
  useEffect(() => {
    if (!isDataReady) return
    const shadowStr = sessionStorage.getItem('active_session_shadow')
    if (shadowStr) {
      try {
        const shadow = JSON.parse(shadowStr)
        if (shadow && shadow.isTimerActive && shadow.secondsElapsed >= 60) {
          const runRestore = async () => {
            const elapsedMin = Math.floor(shadow.secondsElapsed / 60)
            const now = new Date()
            const timestamp = `${monthNames[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            
            // 1. Add entry to Dexie history
            await addHistoryEntry({
              timestamp,
              type: shadow.mode,
              durationMinutes: elapsedMin,
              categoryId: shadow.mode === 'study' ? shadow.categoryId : undefined,
            })
            
            // 2. Increment daily log minutes
            const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            const existing = await db.daily_logs.get(current)
            if (shadow.mode === 'study') {
              if (existing) {
                await db.daily_logs.update(current, { studyMinutes: existing.studyMinutes + elapsedMin })
              } else {
                await db.daily_logs.add({ dateString: current, studyMinutes: elapsedMin, breakMinutes: 0 })
              }
            } else {
              if (existing) {
                await db.daily_logs.update(current, { breakMinutes: existing.breakMinutes + elapsedMin })
              } else {
                await db.daily_logs.add({ dateString: current, studyMinutes: 0, breakMinutes: elapsedMin })
              }
            }
            
            // 3. Trigger HUD toast notification
            setActiveToast({
              key: 'RESTORE',
              message: `RECOVERED ${elapsedMin}M INTERRUPTED ${shadow.mode.toUpperCase()}`,
              id: Date.now()
            })
          }
          runRestore()
        }
      } catch (err) {
        console.error('Failed to restore shadow session:', err)
      } finally {
        sessionStorage.removeItem('active_session_shadow')
      }
    }
  }, [isDataReady])



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
      return { output: src, stop: () => { try { src.stop(); src.disconnect() } catch {} } }
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

      // Transient Rain Clicks: Dynamic procedural scheduler for micro noise bursts (striking glass pane)
      let rainClickInterval: any = null
      const scheduleRainClick = (time: number) => {
        try {
          const clickBuf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate)
          const clickData = clickBuf.getChannelData(0)
          for (let i = 0; i < clickData.length; i++) {
            clickData[i] = Math.random() * 2 - 1
          }
          const clickNode = ctx.createBufferSource()
          clickNode.buffer = clickBuf
          
          const clickFilter = ctx.createBiquadFilter()
          clickFilter.type = 'bandpass'
          clickFilter.frequency.setValueAtTime(1400 + Math.random() * 800, time)
          clickFilter.Q.setValueAtTime(4, time)
          
          const clickGain = ctx.createGain()
          clickGain.gain.setValueAtTime(0, time)
          clickGain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.06, time + 0.001) // Instant attack (0.001s)
          clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02) // Exponential decay down to 0 inside 0.02s
          
          clickNode.connect(clickFilter)
          clickFilter.connect(clickGain)
          clickGain.connect(ampGain) // Connected to rain's ampGain so volume scales with rain slider
          
          clickNode.start(time)
          clickNode.onended = () => {
            try {
              clickNode.disconnect()
              clickFilter.disconnect()
              clickGain.disconnect()
            } catch {}
          }
        } catch {}
      }

      const runScheduler = () => {
        const nextDelay = 40 + Math.random() * 120
        rainClickInterval = setTimeout(() => {
          if (ctx.state !== 'closed') {
            scheduleRainClick(ctx.currentTime)
            runScheduler()
          }
        }, nextDelay)
      }
      runScheduler()

      return {
        output: ampGain,
        stop: () => {
          try {
            clearTimeout(rainClickInterval)
            src.stop()
            lfo.stop()
            src.disconnect()
            filter.disconnect()
            lfo.disconnect()
            lfoGain.disconnect()
            ampGain.disconnect()
          } catch {}
        }
      }
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
      return {
        output: gain,
        stop: () => {
          try {
            src.stop()
            src.disconnect()
            bandpass.disconnect()
            gain.disconnect()
          } catch {}
        }
      }
    }
    if (track === 'alphaWaves') {
      const oscL = ctx.createOscillator()
      const oscR = ctx.createOscillator()
      
      oscL.type = 'sine'
      oscL.frequency.setValueAtTime(100, ctx.currentTime)
      
      oscR.type = 'sine'
      oscR.frequency.setValueAtTime(110, ctx.currentTime)
      
      const pannerL = ctx.createStereoPanner()
      pannerL.pan.setValueAtTime(-1, ctx.currentTime)
      
      const pannerR = ctx.createStereoPanner()
      pannerR.pan.setValueAtTime(1, ctx.currentTime)
      
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime) // Delicate main gain node
      
      oscL.connect(pannerL)
      pannerL.connect(gainNode)
      
      oscR.connect(pannerR)
      pannerR.connect(gainNode)
      
      oscL.start()
      oscR.start()
      
      return {
        output: gainNode,
        stop: () => {
          try {
            oscL.stop()
            oscR.stop()
            oscL.disconnect()
            oscR.disconnect()
            pannerL.disconnect()
            pannerR.disconnect()
            gainNode.disconnect()
          } catch {}
        }
      }
    }
    return null
  }

  const updateAudioMixer = () => {
    try {
      const isStudyActive = timerMode === 'study' && isTimerActive

      const tracks = [
        { id: 'rain', vol: localVolumeRain },
        { id: 'cafe', vol: localVolumeCafe },
        { id: 'whiteNoise', vol: localVolumeWhiteNoise },
        { id: 'alphaWaves', vol: localAlphaWaves ? 0.35 : 0 }
      ]

      const anyActive = isStudyActive && tracks.some(t => t.vol > 0)

      if (!anyActive) {
        tracks.forEach(t => {
          const ch = channelsRef.current[t.id]
          if (ch && ch.stop) {
            try { ch.stop() } catch {}
            channelsRef.current[t.id] = { source: null, gainNode: null, stop: null }
          }
        })
        if (audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
          audioCtxRef.current.suspend()
        }
        return
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const ctx = audioCtxRef.current

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      tracks.forEach(t => {
        const ch = channelsRef.current[t.id]
        const shouldPlay = isStudyActive && t.vol > 0

        if (shouldPlay) {
          if (!ch.source) {
            const gainNode = ctx.createGain()
            gainNode.gain.setValueAtTime(t.vol, ctx.currentTime)
            gainNode.connect(ctx.destination)

            const result = createAmbientTrack(ctx, t.id === 'whiteNoise' ? 'white-noise' : t.id)
            if (result) {
              result.output.connect(gainNode)
              channelsRef.current[t.id] = {
                source: result.output,
                gainNode: gainNode,
                stop: () => {
                  try {
                    result.stop()
                    gainNode.disconnect()
                  } catch {}
                }
              }
            } else {
              gainNode.disconnect()
            }
          } else {
            if (ch.gainNode) {
              ch.gainNode.gain.setValueAtTime(t.vol, ctx.currentTime)
            }
          }
        } else {
          if (ch.stop) {
            try { ch.stop() } catch {}
            channelsRef.current[t.id] = { source: null, gainNode: null, stop: null }
          }
        }
      })
    } catch (err) {
      console.error('Failed to update audio mixer:', err)
    }
  }

  useEffect(() => {
    updateAudioMixer()
    return () => {
      const tracks = ['rain', 'cafe', 'whiteNoise', 'alphaWaves']
      tracks.forEach(id => {
        const ch = channelsRef.current[id]
        if (ch && ch.stop) {
          try { ch.stop() } catch {}
        }
      })
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch {}
        audioCtxRef.current = null
      }
    }
  }, [timerMode, isTimerActive, localVolumeRain, localVolumeCafe, localVolumeWhiteNoise, localAlphaWaves])


  // Tactile Mechanical Thock Keystroke & Click Captures
  useEffect(() => {
    const handleKeystroke = () => {
      if (localTactileFeedback) {
        playTactileThock()
      }
    }
    window.addEventListener('keydown', handleKeystroke, true)
    return () => window.removeEventListener('keydown', handleKeystroke, true)
  }, [localTactileFeedback])

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!localTactileFeedback) return
      const target = e.target as HTMLElement
      const isInteractive = target.closest('button') || target.closest('a') || target.tagName === 'INPUT' || target.tagName === 'SELECT'
      if (isInteractive) {
        playTactileThock()
      }
    }
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [localTactileFeedback])

  // HUD Toast Auto-Dismiss
  useEffect(() => {
    if (!activeToast) return
    const timer = setTimeout(() => {
      setActiveToast(null)
    }, 1500)
    return () => clearTimeout(timer)
  }, [activeToast])

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (activeView === 'settings' || isHotkeyHudOpen) return
      if (completingRef.current) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      switch (key) {
        case ' ':
          e.preventDefault()
          setIsTimerActive(active => {
            const nextActive = !active
            setActiveToast({
              key: 'SPACE',
              message: nextActive ? 'FOCUS ENGINE ACTIVE' : 'FOCUS ENGINE PAUSED',
              id: Date.now()
            })
            return nextActive
          })
          break
        case 's':
          handleModeSwitchRef.current('study')
          setActiveToast({ key: 'S', message: 'SWITCHED TO DEEP WORK', id: Date.now() })
          break
        case 'b':
          handleModeSwitchRef.current('break')
          setActiveToast({ key: 'B', message: 'SWITCHED TO BREAK MODE', id: Date.now() })
          break
        case 'c':
          completeSessionRef.current()
          setActiveToast({ key: 'C', message: 'FOCUS BLOCK COMPLETED', id: Date.now() })
          break
        case 'z':
          setIsZenMode(zen => {
            const nextZen = !zen
            setActiveToast({
              key: 'Z',
              message: nextZen ? 'ENTERED ZEN SANCTUARY' : 'EXITED ZEN SANCTUARY',
              id: Date.now()
            })
            return nextZen
          })
          break
        case '?':
          setIsHotkeyHudOpen(o => {
            const nextOpen = !o
            setActiveToast({
              key: '?',
              message: nextOpen ? 'OPENED SHORTCUT PANEL' : 'CLOSED SHORTCUT PANEL',
              id: Date.now()
            })
            return nextOpen
          })
          break
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [activeView, isHotkeyHudOpen])


  async function resetData() {
    const tracks = ['rain', 'cafe', 'whiteNoise', 'alphaWaves']
    tracks.forEach(id => {
      const ch = channelsRef.current[id]
      if (ch && ch.stop) {
        try { ch.stop() } catch {}
        channelsRef.current[id] = { source: null, gainNode: null, stop: null }
      }
    })
    if (audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
      audioCtxRef.current.suspend()
    }

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
      { key: 'ambientVolume_rain', value: 0.5 },
      { key: 'ambientVolume_cafe', value: 0.5 },
      { key: 'ambientVolume_whiteNoise', value: 0.5 },
      { key: 'ambient_alphaWaves', value: false },
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
    setLocalVolumeRain(0.5)
    setLocalVolumeCafe(0.5)
    setLocalVolumeWhiteNoise(0.5)
    setLocalAlphaWaves(false)
    setActiveTaskId(null)
  }



  const activeTasksList = useMemo(() => {
    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    return sessionTasks.filter(task => {
      if (task.completed && task.nextReviewDate && task.nextReviewDate > todayStr) {
        return false
      }
      return true
    })
  }, [sessionTasks])

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

  const activeThemeVars = THEME_PROFILES[theme] || THEME_PROFILES['midnight-slate']

  const inlineStyles = {
    '--color-surface': activeThemeVars.surface,
    '--color-surface-card': activeThemeVars.surfaceCard,
    '--color-accent-blue': activeThemeVars.accentBlue,
    '--color-accent-purple': activeThemeVars.accentPurple,
    '--color-accent-green': activeThemeVars.accentGreen,
    '--color-accent-amber': activeThemeVars.accentAmber,
    '--surface-card-rgb': activeThemeVars.surfaceCardRgb,
    '--card-opacity': cardOpacity,
    '--backdrop-blur': `${backdropBlur}px`,
    '--font-family-override': localDeveloperFont === 'Inter' ? "'Inter', system-ui, sans-serif" : `'${localDeveloperFont}', monospace`,
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-surface font-sans text-text-primary antialiased relative" style={inlineStyles}>
      <div className={`w-full max-w-[1650px] min-h-screen mx-auto p-4 md:p-6 lg:p-8 flex flex-col justify-between transition-all duration-700 ${
        isZenMode ? 'opacity-10 blur-md pointer-events-none scale-95' : ''
      }`}>
        {activeView === 'dashboard' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 w-full">

          {/* COLUMN 1: Focus Core Command Center */}
          <div className={`h-full flex flex-col transition-all duration-500 ${
            isZenMode ? 'mx-auto max-w-2xl w-full flex-1 scale-[1.02]' : ''
          }`}>

            {/* CARD 1: Today's Progress */}
            <div className="relative overflow-hidden flex flex-col h-full rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 dynamic-card shadow-xl p-5">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-purple-500/40 via-blue-500/40 to-transparent" />
              <div className="mb-5 flex items-center gap-2">
                <Target className="h-5 w-5 text-accent-blue" />
                <h2 className="text-sm font-semibold tracking-wide text-slate-200">Today's Progress</h2>
                <button
                  onClick={() => setIsZenMode(z => !z)}
                  className={`ml-3 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                    isZenMode
                      ? 'border-accent-purple/40 bg-accent-purple/20 text-accent-purple'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                  title="Press 'Z' to toggle Zen Mode"
                >
                  {isZenMode ? 'Exit Zen' : 'Zen (Z)'}
                </button>
                {!isZenMode && (
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
                )}
              </div>
              <div className="flex flex-col lg:flex-row xl:flex-col gap-6 flex-1 min-h-0">
                {/* Left - Circular Ring + Stats */}
                <div className="flex flex-row lg:flex-col xl:flex-row items-center justify-around gap-4 shrink-0 w-full lg:w-44 xl:w-full border-b border-slate-800/40 pb-5 lg:border-b-0 lg:pb-0 xl:border-b xl:pb-5">
                  <div className="flex flex-col items-center">
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
                          fill="none" stroke="var(--color-accent-blue)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="314.16"
                          strokeDashoffset={String(314.16 * (1 - progress))}
                          filter="url(#glow)"
                          style={{ transition: 'stroke-dashoffset 1s linear' }}
                        />
                      </svg>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-text-primary">{formatMinutes(todayStudyMinutes)}</p>
                        <p className="text-xs text-slate-400">of {Math.round(dailyGoalMinutes / 60)}h goal</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-text-secondary">Study time</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 max-w-[200px] w-full">
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
                <div className="flex flex-1 flex-col gap-3 min-h-0 w-full">
                  {!isZenMode && (
                    <>
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
                    </>
                  )}
                  {/* Timer Controls */}
                  <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-300 ${
                    isLongBreak && timerMode === 'break'
                      ? 'border-accent-green/30 bg-accent-green/5'
                      : 'border-slate-800 bg-slate-950/45 hover:bg-slate-950/60'
                  }`}>
                    <div className="flex overflow-hidden rounded-md border border-slate-800 bg-[#0B0F19] p-0.5">
                      <button
                        onClick={() => handleModeSwitch('study')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                          timerMode === 'study'
                            ? 'bg-accent-blue/15 text-accent-blue font-semibold'
                            : 'text-slate-400 hover:text-text-primary'
                        }`}
                      >
                        Study
                      </button>
                      <button
                        onClick={() => handleModeSwitch('break')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                          timerMode === 'break'
                            ? isLongBreak
                              ? 'bg-accent-green/15 text-accent-green font-semibold'
                              : 'bg-accent-amber/15 text-accent-amber font-semibold'
                            : 'text-slate-400 hover:text-text-primary'
                        }`}
                      >
                        {isLongBreak && timerMode === 'break' ? 'Long Break' : 'Break'}
                      </button>
                    </div>
                    {timerMode === 'study' && !isZenMode && (
                      <>
                        <select
                          value={timerCategoryId ?? ''}
                          onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                          className="rounded border border-slate-800 bg-[#0B0F19] px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-blue/50 cursor-pointer transition-all"
                        >
                          <option value="" className="bg-[#0B0F19]">Subject</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-[#0B0F19]">{cat.name}</option>
                          ))}
                        </select>
                        <div className="h-5 w-px bg-slate-800" />
                      </>
                    )}
                    {timerMode !== 'study' && !isZenMode && <div className="h-5 w-px bg-slate-800" />}
                    <span className={`min-w-[45px] text-sm font-semibold tabular-nums ${
                      isLongBreak && timerMode === 'break' ? 'text-accent-green' : 'text-accent-blue'
                    }`}>
                      {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                    </span>
                    {/* Cycle progress pips */}
                    {!isZenMode && (
                      <div className="flex items-center gap-1.5" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} sessions in current cycle`}>
                        {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                              i < completedSessionsInCycle
                                ? 'bg-accent-blue shadow-sm shadow-accent-blue/40 scale-110'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { if (!completingRef.current) setIsTimerActive(a => !a) }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue transition-all hover:bg-accent-blue/20 hover:shadow-md hover:shadow-accent-blue/20 active:scale-95 cursor-pointer"
                    >
                      {isTimerActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    {(isTimerActive || secondsElapsed > 0) && (
                      <button
                        onClick={completeSession}
                        className="flex items-center gap-1 rounded-md bg-accent-green/15 text-accent-green border border-accent-green/20 px-2 py-1 text-xs font-semibold transition-all hover:bg-accent-green/25 active:scale-95 cursor-pointer"
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
                        <span className="ml-auto whitespace-nowrap text-[11px] text-slate-400 flex items-center gap-1">
                          <Target className="h-3 w-3 text-accent-blue" />
                          <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1}</span>
                        </span>
                      </div>
                    )
                  })()}
                  {/* Task Planner - Hide in Zen Mode */}
                  {!isZenMode && (
                    <div className="flex flex-col flex-1 min-h-[200px] space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          data-task-input
                          type="text"
                          placeholder="Add a task..."
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-950/70 focus:bg-slate-950 focus:border-accent-blue/50 px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-500 outline-none transition-all duration-200"
                          onKeyDown={(e) => { if (e.key === 'Enter') { const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-cycles]'); handleAddTask((e.target as HTMLInputElement).value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); (e.target as HTMLInputElement).value = '' } }}
                        />
                        <select
                          data-task-category
                          className="w-24 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-950/70 focus:bg-[#0B0F19] focus:border-accent-blue/50 px-1.5 py-1.5 text-xs text-text-primary outline-none transition-all duration-200 cursor-pointer"
                        >
                          <option value="" className="bg-[#0B0F19]">No category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-[#0B0F19]">{cat.name}</option>
                          ))}
                        </select>
                        <select
                          data-task-cycles
                          value={taskCycleCount}
                          onChange={e => setTaskCycleCount(Number(e.target.value))}
                          className="w-14 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-950/70 focus:bg-[#0B0F19] focus:border-accent-blue/50 px-1 py-1.5 text-xs text-text-primary outline-none transition-all duration-200 cursor-pointer"
                        >
                          {[1,2,3,4,5,6,7,8].map(n => (
                            <option key={n} value={n} className="bg-[#0B0F19]">🎯 {n}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { const input = document.querySelector<HTMLInputElement>('[data-task-input]'); const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-cycles]'); if (input) { handleAddTask(input.value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); input.value = '' } }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto min-h-[100px] flex flex-col">
                        {activeTasksList.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center h-full min-h-[220px] border-2 border-dashed border-slate-800 bg-slate-950/20 hover:bg-slate-950/45 hover:border-slate-700/60 rounded-xl p-6 my-2 text-center transition-all duration-300 shadow-inner group">
                            <span className="text-3xl mb-3 animate-pulse-soft filter drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">🎯</span>
                            <p className="text-xs font-semibold text-slate-200 max-w-[220px] leading-relaxed">
                              No focus tasks planned for today.
                            </p>
                            <p className="text-[11px] text-slate-500 max-w-[200px] mt-1.5 leading-normal">
                              Add an objective above to lock in your active target focus!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {activeTasksList.map(task => (
                              <div
                                key={task.id}
                                onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                                className={`flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer animate-slide-in-up ${
                                  activeTaskId === task.id
                                    ? 'bg-accent-blue/10 ring-1 ring-accent-blue/30'
                                    : 'hover:bg-surface/50'
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full">
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
                                  <span className="shrink-0 text-[11px] text-slate-400 flex items-center gap-1">
                                    <Target className="h-3 w-3 text-accent-blue" />
                                    <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1}</span>
                                  </span>
                                </div>

                                {task.completed && (
                                  <div className="mt-1 flex flex-col gap-1 pl-6 border-l border-slate-800" onClick={e => e.stopPropagation()}>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Rate your Active Recall (SM-2)</p>
                                    <div className="flex gap-1.5">
                                      {[0, 1, 2, 3, 4, 5].map(q => (
                                        <button
                                          key={q}
                                          onClick={(e) => { e.stopPropagation(); submitRecallGrade(task, q) }}
                                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-accent-purple/20 hover:text-accent-purple border border-slate-700 hover:border-accent-purple/30 text-slate-300 transition-all cursor-pointer"
                                          title={
                                            q === 0 ? "Complete Blackout" :
                                            q === 1 ? "Incorrect but remembered" :
                                            q === 2 ? "Incorrect, easy to recall after looking" :
                                            q === 3 ? "Correct with serious effort" :
                                            q === 4 ? "Correct after hesitation" :
                                            "Perfect response"
                                          }
                                        >
                                          {q}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Ambient Soundscape Mixer - Hide in Zen Mode */}
                  {!isZenMode && (
                    <div className="mt-4 border-t border-slate-800/50 pt-3">
                      <p className="text-[11px] font-semibold text-slate-400 mb-2.5 tracking-wider uppercase">Ambient Soundscapes Mixer</p>
                      <div className="flex flex-col gap-2">
                        {[
                          { id: 'ambientVolume_rain', label: 'Rain', icon: CloudRain, val: localVolumeRain, colorClass: 'accent-accent-blue', setVal: setLocalVolumeRain },
                          { id: 'ambientVolume_cafe', label: 'Cafe', icon: Coffee, val: localVolumeCafe, colorClass: 'accent-accent-amber', setVal: setLocalVolumeCafe },
                          { id: 'ambientVolume_whiteNoise', label: 'White Noise', icon: Radio, val: localVolumeWhiteNoise, colorClass: 'accent-accent-purple', setVal: setLocalVolumeWhiteNoise },
                        ].map(ch => {
                          const Icon = ch.icon
                          return (
                            <div key={ch.id} className="flex items-center gap-3 bg-slate-950/30 border border-slate-800/40 rounded-lg px-3 py-1.5 hover:bg-slate-950/50 transition-all duration-200">
                              <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs font-medium text-slate-300 w-20 shrink-0">{ch.label}</span>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={ch.val}
                                onChange={e => {
                                  const v = parseFloat(e.target.value)
                                  ch.setVal(v)
                                  updateSetting(ch.id as SettingsKey, v)
                                }}
                                className={`flex-1 h-1.5 rounded-full cursor-pointer bg-slate-800 outline-none ${ch.colorClass}`}
                              />
                              <span className="text-[10px] font-semibold text-slate-500 w-6 text-right tabular-nums">
                                {Math.round(ch.val * 100)}%
                              </span>
                            </div>
                          )
                        })}

                        {/* Alpha Waves (10Hz Binaural Beat) */}
                        <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/40 rounded-lg px-3 py-1.5 hover:bg-slate-950/50 transition-all duration-200 mt-1">
                          <div className="flex items-center gap-3">
                            <Brain className="h-3.5 w-3.5 text-accent-purple shrink-0" />
                            <span className="text-xs font-medium text-slate-300">Alpha Waves (10Hz)</span>
                          </div>
                          <button
                            onClick={() => {
                              const nextVal = !localAlphaWaves
                              setLocalAlphaWaves(nextVal)
                              updateSetting('ambient_alphaWaves', nextVal)
                            }}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-all cursor-pointer ${
                              localAlphaWaves ? 'bg-accent-purple animate-pulse-soft' : 'bg-slate-800'
                            }`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                              localAlphaWaves ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>

                        {/* Tactile Keyboard Click Feedback */}
                        <div className="flex items-center justify-between bg-slate-950/30 border border-slate-800/40 rounded-lg px-3 py-1.5 hover:bg-slate-950/50 transition-all duration-200 mt-1">
                          <div className="flex items-center gap-3">
                            <Keyboard className="h-3.5 w-3.5 text-accent-blue shrink-0" />
                            <span className="text-xs font-medium text-slate-300">Tactile Thocks</span>
                          </div>
                          <button
                            onClick={() => {
                              const nextVal = !localTactileFeedback
                              setLocalTactileFeedback(nextVal)
                              updateSetting('tactile_feedback', nextVal)
                            }}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-all cursor-pointer ${
                              localTactileFeedback ? 'bg-accent-blue' : 'bg-slate-800'
                            }`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                              localTactileFeedback ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


        {/* COLUMN 2: Analytical Intelligence Hub */}
        <div className={`flex flex-col gap-6 h-full transition-all duration-500 ${
          isZenMode ? 'opacity-0 scale-95 pointer-events-none w-0 h-0 overflow-hidden absolute' : ''
        }`}>

          {/* CARD 2: Weekly Rhythm */}
          <div className="rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 dynamic-card shadow-xl p-5">
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
                <div key={m.label} className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface/50 px-3 py-2.5 animate-slide-in-up">
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
                  <div key={m.label} className="rounded-lg border border-slate-800/60 dynamic-card p-3">
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
          <div className="rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 dynamic-card shadow-xl p-5">
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
                  onClick={() => setActiveView('settings')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-surface hover:text-text-primary cursor-pointer"
                  title="Open configuration deck"
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
        <div className={`flex flex-col gap-6 transition-all duration-500 ${
          isZenMode ? 'opacity-0 scale-95 pointer-events-none w-0 h-0 overflow-hidden absolute' : ''
        }`}>

          {/* CARD 4: Monthly Overview */}
          <div className="flex flex-col rounded-xl border border-slate-800/60 hover:border-slate-700/50 transition-all duration-300 dynamic-card shadow-xl p-5">
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

              {/* Daily Focus Horizon */}
              <div className="mt-4 border-t border-slate-800/40 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Daily Focus Horizon</p>
                <div className="relative w-full bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
                  {/* Timeline Bar */}
                  <div className="relative h-4 w-full bg-slate-900/60 rounded-md border border-slate-800 overflow-hidden shadow-inner">
                    {/* Time ticks / grid */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none text-[8px] text-slate-600 font-mono">
                      <div className="h-full border-r border-slate-800/30" style={{ left: '25%' }} />
                      <div className="h-full border-r border-slate-800/30" style={{ left: '50%' }} />
                      <div className="h-full border-r border-slate-800/30" style={{ left: '75%' }} />
                    </div>

                    {/* Mapped study and break sessions */}
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
                      const titleText = `${isStudy ? 'Deep Work Cycle' : 'Break Time'}: ${entry.durationMinutes}m (ending at ${timePart})`
                      
                      return (
                        <div
                          key={idx}
                          title={titleText}
                          className={`absolute top-0 h-full rounded-sm transition-all hover:scale-y-110 cursor-pointer ${
                            isStudy
                              ? 'bg-gradient-to-r from-accent-blue to-accent-purple shadow-[0_0_6px_rgba(59,130,246,0.35)] z-10'
                              : 'bg-slate-700/80'
                          }`}
                          style={{
                            left: `${startPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                        />
                      )
                    })}
                  </div>
                  {/* Timeline labels */}
                  <div className="flex justify-between text-[8px] text-slate-500 font-mono mt-1 px-1 select-none">
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
      </div>
    ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full flex-1">
            {/* Sidebar Pane (Col-span 1) */}
            <div className="md:col-span-1 rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5 flex flex-col justify-between">
              <div className="space-y-6">
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-450 hover:text-text-primary transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </button>
                <div>
                  <h2 className="text-lg font-bold text-slate-200">Control Deck</h2>
                  <p className="text-xs text-slate-500 mt-1">Config and customization</p>
                </div>
                <nav className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={() => setSettingsTab('visual')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsTab === 'visual'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                        : 'text-slate-400 hover:bg-slate-950/20 hover:text-text-primary border border-transparent'
                    }`}
                  >
                    <Sliders className="h-4 w-4" />
                    <span>Visual Theme</span>
                  </button>
                  <button
                    onClick={() => setSettingsTab('audio')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsTab === 'audio'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                        : 'text-slate-400 hover:bg-slate-950/20 hover:text-text-primary border border-transparent'
                    }`}
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Audio Soundscape</span>
                  </button>
                  <button
                    onClick={() => setSettingsTab('metrics')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsTab === 'metrics'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                        : 'text-slate-400 hover:bg-slate-950/20 hover:text-text-primary border border-transparent'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Focus & Categories</span>
                  </button>
                  <button
                    onClick={() => setSettingsTab('vault')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsTab === 'vault'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                        : 'text-slate-400 hover:bg-slate-950/20 hover:text-text-primary border border-transparent'
                    }`}
                  >
                    <Database className="h-4 w-4" />
                    <span>Vault Backup</span>
                  </button>
                </nav>
              </div>
              <div className="border-t border-slate-800/60 pt-4 mt-6">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  <span>Phase 24 Engine</span>
                </div>
              </div>
            </div>

            {/* Configuration Workspace (Col-span 3) */}
            <div className="md:col-span-3 flex flex-col gap-6">
              {settingsTab === 'visual' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Select Theme Profile</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(THEME_PROFILES).map(([key, profile]) => {
                          const isSelected = theme === key
                          const displayName = key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                          return (
                            <button
                              key={key}
                              onClick={() => updateSetting('theme', key)}
                              className={`relative flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                                isSelected
                                  ? 'border-accent-blue bg-accent-blue/10 shadow-lg shadow-accent-blue/10'
                                  : 'border-slate-800/80 bg-slate-950/20 hover:border-slate-700 hover:bg-slate-950/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3 w-full">
                                <span className="text-xs font-bold text-slate-200">{displayName}</span>
                                {isSelected && (
                                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-accent-blue text-slate-950">
                                    <Check className="h-3 w-3 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2.5">
                                <span className="h-4.5 w-4.5 rounded-full border border-slate-800" style={{ backgroundColor: profile.surface }} title="Background" />
                                <span className="h-4.5 w-4.5 rounded-full border border-slate-800" style={{ backgroundColor: profile.surfaceCard }} title="Cards" />
                                <div className="h-4 w-px bg-slate-800" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentBlue }} title="Primary Blue Accent" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentPurple }} title="Purple Accent" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentGreen }} title="Green Accent" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentAmber }} title="Amber Accent" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-5">Translucency & Frosting</h3>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-300">Card Opacity</span>
                            <span className="text-xs font-bold text-accent-blue">{Math.round(cardOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.20"
                            max="0.90"
                            step="0.05"
                            value={cardOpacity}
                            onChange={e => updateSetting('cardOpacity', parseFloat(e.target.value))}
                            className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-slate-800 outline-none"
                          />
                          <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-semibold">
                            <span>20% (Max Glass)</span>
                            <span>90% (Max Solid)</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-300">Backdrop Frosting Blur</span>
                            <span className="text-xs font-bold text-accent-blue">{backdropBlur}px</span>
                          </div>
                          <input
                            type="range"
                            min="4"
                            max="24"
                            step="1"
                            value={backdropBlur}
                            onChange={e => updateSetting('backdropBlur', parseInt(e.target.value))}
                            className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-slate-800 outline-none"
                          />
                          <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-semibold">
                            <span>4px (Sharp)</span>
                            <span>24px (Muted Frost)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Typography Calibration</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-2">Developer Font Family</label>
                          <select
                            value={localDeveloperFont}
                            onChange={e => {
                              const val = e.target.value
                              setLocalDeveloperFont(val)
                              updateSetting('developer_font', val)
                            }}
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-text-primary outline-none focus:border-accent-blue/50 cursor-pointer transition-all"
                          >
                            <option value="JetBrains Mono">JetBrains Mono (Console default)</option>
                            <option value="Fira Code">Fira Code (Ligature ready)</option>
                            <option value="SF Mono">SF Mono (System premium)</option>
                            <option value="Inter">Inter (Sans-serif modern)</option>
                          </select>
                          <p className="mt-1.5 text-[10px] text-slate-500 font-semibold">
                            Applies immediately to all user interface panels and timer text overlays.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-1">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5 flex flex-col h-full">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Sandbox Preview</h3>
                      <div className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border border-slate-800 bg-[#0B0F19] relative overflow-hidden min-h-[280px] w-full">
                        <div className="absolute top-1/4 left-1/4 h-28 w-28 rounded-full bg-accent-blue/30 blur-2xl animate-pulse-soft" />
                        <div className="absolute bottom-1/4 right-1/4 h-24 w-24 rounded-full bg-accent-purple/35 blur-2xl" />
                        <div className="absolute top-1/2 right-1/3 h-16 w-16 rounded-full bg-accent-amber/20 blur-xl" />

                        <div className="relative w-full max-w-[240px] space-y-3.5 z-10">
                          <div className="flex items-center justify-between px-1">
                            <span className="h-3 w-16 rounded bg-slate-700/65" />
                            <div className="flex gap-1">
                              <span className="h-3.5 w-3.5 rounded-full bg-accent-blue/20 flex items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-accent-blue" /></span>
                              <span className="h-3.5 w-3.5 rounded-full bg-accent-purple/20 flex items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-accent-purple" /></span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-800/60 dynamic-card p-2.5 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="h-2 w-8 rounded bg-slate-700/65" />
                                <span className="h-2.5 w-2.5 rounded bg-accent-blue/20" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="relative h-7 w-7 rounded-full border-2 border-slate-800 flex items-center justify-center">
                                  <div className="h-4.5 w-4.5 rounded-full border-2 border-accent-blue border-r-transparent animate-spin-slow" />
                                  <span className="absolute text-[8px] font-bold text-accent-blue scale-90">65</span>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <span className="h-1.5 w-full rounded bg-slate-700/65 block" />
                                  <span className="h-1 w-6 rounded bg-slate-700/65 block" />
                                </div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-800/60 dynamic-card p-2.5 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="h-2 w-10 rounded bg-slate-700/65" />
                                <span className="h-2.5 w-2.5 rounded bg-accent-purple/20" />
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="h-2.5 w-2.5 rounded border border-accent-blue/50 flex items-center justify-center bg-accent-blue/10"><Check className="h-2.5 w-2.5 text-accent-blue" /></span>
                                  <span className="h-1.5 w-12 rounded bg-slate-700/40" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="h-2.5 w-2.5 rounded border border-slate-700" />
                                  <span className="h-1.5 w-10 rounded bg-slate-700/40" />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-800/60 dynamic-card p-2.5 space-y-2">
                            <span className="h-2 w-12 rounded bg-slate-700/65 block" />
                            <div className="h-8 flex items-end gap-1.5 px-1 bg-slate-950/20 rounded border border-slate-900/50 p-1">
                              {[30, 45, 60, 40, 75, 90, 50].map((h, idx) => (
                                <div key={idx} className="flex-1 bg-gradient-to-t from-accent-blue to-accent-purple rounded-t-sm" style={{ height: `${h}%` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold mt-3 text-center">
                        Glow spheres preview glassmorphism depth. Adjust opacity and blur to check transparency blending.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'audio' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-5">Ambient Soundscapes Mixer</h3>
                      <div className="flex flex-col gap-4">
                        {[
                          { id: 'ambientVolume_rain', label: 'Rain soundscape', icon: CloudRain, val: localVolumeRain, colorClass: 'accent-accent-blue', setVal: setLocalVolumeRain },
                          { id: 'ambientVolume_cafe', label: 'Cafe ambiance', icon: Coffee, val: localVolumeCafe, colorClass: 'accent-accent-amber', setVal: setLocalVolumeCafe },
                          { id: 'ambientVolume_whiteNoise', label: 'White Noise floor', icon: Radio, val: localVolumeWhiteNoise, colorClass: 'accent-accent-purple', setVal: setLocalVolumeWhiteNoise },
                        ].map(ch => {
                          const Icon = ch.icon
                          return (
                            <div key={ch.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-950/30 border border-slate-800/40 rounded-xl px-4 py-3 hover:bg-slate-950/50 transition-all duration-200">
                              <div className="flex items-center gap-3 w-36 shrink-0">
                                <Icon className="h-4 w-4 text-slate-400" />
                                <span className="text-xs font-semibold text-slate-300">{ch.label}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={ch.val}
                                onChange={e => {
                                  const v = parseFloat(e.target.value)
                                  ch.setVal(v)
                                  updateSetting(ch.id as SettingsKey, v)
                                }}
                                className={`flex-1 h-1.5 rounded-full cursor-pointer bg-slate-800 outline-none ${ch.colorClass}`}
                              />
                              <span className="text-xs font-bold text-slate-400 w-10 text-right tabular-nums">
                                {Math.round(ch.val * 100)}%
                              </span>
                            </div>
                          )
                        })}

                        {/* Deep Focus Alpha Waves (10Hz Beat) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/30 border border-slate-800/40 rounded-xl px-4 py-3 hover:bg-slate-950/50 transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <Brain className="h-4 w-4 text-accent-purple shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-slate-300 block">Deep Focus Alpha Waves</span>
                              <span className="text-[10px] text-slate-500 font-medium">Binaural 10Hz brainwave beat (100Hz Left / 110Hz Right)</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const nextVal = !localAlphaWaves
                              setLocalAlphaWaves(nextVal)
                              updateSetting('ambient_alphaWaves', nextVal)
                            }}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${
                              localAlphaWaves ? 'bg-accent-purple animate-pulse-soft' : 'bg-slate-800'
                            }`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              localAlphaWaves ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>

                        {/* Tactile Keyboard Click Feedback */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/30 border border-slate-800/40 rounded-xl px-4 py-3 hover:bg-slate-950/50 transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <Keyboard className="h-4 w-4 text-accent-blue shrink-0" />
                            <div>
                              <span className="text-xs font-semibold text-slate-300 block">Tactile Thocks</span>
                              <span className="text-[10px] text-slate-500 font-medium">Synthesizes a mechanical keyboard brown switch thock on keystrokes and controls</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const nextVal = !localTactileFeedback
                              setLocalTactileFeedback(nextVal)
                              updateSetting('tactile_feedback', nextVal)
                            }}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${
                              localTactileFeedback ? 'bg-accent-blue' : 'bg-slate-800'
                            }`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              localTactileFeedback ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-1">Sound Effects</h3>
                          <p className="text-xs text-slate-400">Play responsive chime when study or break timer cycles complete</p>
                        </div>
                        <button
                          onClick={() => updateSetting('soundEnabled', !soundEnabled)}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${soundEnabled ? 'bg-accent-blue' : 'bg-slate-800'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-1">Enforce Session Boundary</h3>
                          <p className="text-xs text-slate-400">Hides the exit navigation controls inside Zen Mode while the study session is active</p>
                        </div>
                        <button
                          onClick={() => {
                            const nextVal = !localEnforceLockout
                            setLocalEnforceLockout(nextVal)
                            updateSetting('enforce_lockout', nextVal)
                          }}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${localEnforceLockout ? 'bg-accent-purple animate-pulse-soft' : 'bg-slate-800'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${localEnforceLockout ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-1 flex flex-col gap-6">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Preset Snapshots</h3>
                      <div className="space-y-3.5 mb-5 border-b border-slate-800/40 pb-5">
                        <p className="text-xs text-slate-400">Save your current environmental volume balance as a preset snapshot.</p>
                        <div className="flex flex-col gap-2">
                          <input
                            id="preset-name-input"
                            type="text"
                            placeholder="Preset Name (e.g. Rain Cafe)"
                            className="rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-950/70 focus:bg-slate-950 focus:border-accent-blue/50 px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-500 outline-none transition-all duration-200"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value?.trim()
                                if (!val) return
                                const newPreset = {
                                  id: Date.now(),
                                  name: val,
                                  volumes: {
                                    rain: localVolumeRain,
                                    cafe: localVolumeCafe,
                                    whiteNoise: localVolumeWhiteNoise,
                                    alphaWaves: localAlphaWaves
                                  }
                                }
                                updateSetting('audio_presets', [...audio_presets, newPreset])
                                ;(e.target as HTMLInputElement).value = ''
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const el = document.getElementById('preset-name-input') as HTMLInputElement
                              const val = el?.value?.trim()
                              if (!val) return
                              const newPreset = {
                                id: Date.now(),
                                name: val,
                                volumes: {
                                    rain: localVolumeRain,
                                    cafe: localVolumeCafe,
                                    whiteNoise: localVolumeWhiteNoise,
                                    alphaWaves: localAlphaWaves
                                }
                              }
                              updateSetting('audio_presets', [...audio_presets, newPreset])
                              if (el) el.value = ''
                            }}
                            className="w-full rounded-lg bg-accent-blue/15 text-accent-blue border border-accent-blue/20 px-3 py-1.5 text-xs font-semibold hover:bg-accent-blue/25 active:scale-95 transition-all cursor-pointer text-center"
                          >
                            Save Balance Preset
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved Presets</p>
                        {audio_presets.length === 0 ? (
                          <p className="text-xs italic text-slate-500 py-2">No audio presets saved yet.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {audio_presets.map((preset: any) => (
                              <div
                                key={preset.id}
                                className="flex items-center justify-between rounded-lg bg-slate-950/30 hover:bg-slate-950/50 border border-slate-800/40 p-2.5 group hover:border-slate-700/50 transition-all"
                              >
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() => {
                                    const vols = preset.volumes || {}
                                    if (vols.rain !== undefined) {
                                      setLocalVolumeRain(vols.rain)
                                      updateSetting('ambientVolume_rain', vols.rain)
                                    }
                                    if (vols.cafe !== undefined) {
                                      setLocalVolumeCafe(vols.cafe)
                                      updateSetting('ambientVolume_cafe', vols.cafe)
                                    }
                                    if (vols.whiteNoise !== undefined) {
                                      setLocalVolumeWhiteNoise(vols.whiteNoise)
                                      updateSetting('ambientVolume_whiteNoise', vols.whiteNoise)
                                    }
                                    if (vols.alphaWaves !== undefined) {
                                      setLocalAlphaWaves(vols.alphaWaves)
                                      updateSetting('ambient_alphaWaves', vols.alphaWaves)
                                    }
                                  }}
                                >
                                  <p className="text-xs font-semibold text-slate-200">{preset.name}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium font-mono">
                                    🌧️ {Math.round((preset.volumes?.rain ?? 0) * 100)}% · 
                                    ☕ {Math.round((preset.volumes?.cafe ?? 0) * 100)}% · 
                                    📻 {Math.round((preset.volumes?.whiteNoise ?? 0) * 100)}% · 
                                    🧠 Alpha: {preset.volumes?.alphaWaves ? 'On' : 'Off'}
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    const filtered = audio_presets.filter((p: any) => p.id !== preset.id)
                                    updateSetting('audio_presets', filtered)
                                  }}
                                  className="p-1 rounded text-slate-550 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'metrics' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-5">Target Focus Metrics</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="flex flex-col justify-between bg-slate-950/30 border border-slate-800/40 rounded-xl p-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Daily Study Goal</p>
                            <p className="text-[10px] text-slate-505 mt-0.5 font-medium">Target study minutes per day</p>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <button
                              onClick={() => updateSetting('dailyGoalMinutes', Math.max(120, dailyGoalMinutes - 60))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-350 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-200">{Math.round(dailyGoalMinutes / 60)} hours</span>
                            <button
                              onClick={() => updateSetting('dailyGoalMinutes', Math.min(720, dailyGoalMinutes + 60))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-350 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between bg-slate-950/30 border border-slate-800/40 rounded-xl p-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Sessions per Cycle</p>
                            <p className="text-[10px] text-slate-505 mt-0.5 font-medium">Study intervals before long breaks</p>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <button
                              onClick={() => updateSetting('targetSessionsPerCycle', Math.max(2, targetSessionsPerCycle - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-350 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-200">{targetSessionsPerCycle} sessions</span>
                            <button
                              onClick={() => updateSetting('targetSessionsPerCycle', Math.min(6, targetSessionsPerCycle + 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-350 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between bg-slate-950/30 border border-slate-800/40 rounded-xl p-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Short Break Duration</p>
                            <p className="text-[10px] text-slate-505 mt-0.5 font-medium">Breather length between cycles</p>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <button
                              onClick={() => updateSetting('shortBreakDurationMinutes', Math.max(3, shortBreakDurationMinutes - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-300 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-200">{shortBreakDurationMinutes} minutes</span>
                            <button
                              onClick={() => updateSetting('shortBreakDurationMinutes', Math.min(15, shortBreakDurationMinutes + 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-300 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col justify-between bg-slate-950/30 border border-slate-800/40 rounded-xl p-4">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Long Break Duration</p>
                            <p className="text-[10px] text-slate-505 mt-0.5 font-medium">Cooldown limit after target cycles</p>
                          </div>
                          <div className="flex items-center justify-between mt-4">
                            <button
                              onClick={() => updateSetting('longBreakDurationMinutes', Math.max(10, longBreakDurationMinutes - 5))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-300 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-200">{longBreakDurationMinutes} minutes</span>
                            <button
                              onClick={() => updateSetting('longBreakDurationMinutes', Math.min(30, longBreakDurationMinutes + 5))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#0B0F19] text-slate-300 hover:border-slate-700 hover:text-text-primary active:scale-95 transition-all cursor-pointer font-bold animate-transition"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-1">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5 flex flex-col h-full">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Subject Categories</h3>
                      <div className="flex gap-2 mb-4">
                        <input
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          type="text"
                          placeholder="New Subject (e.g. Science)"
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-950/70 focus:bg-slate-950 focus:border-accent-blue/50 px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-550 outline-none transition-all duration-200"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const val = newCategoryName.trim()
                              if (!val) return
                              addCategory(val, newCategoryColor)
                              setNewCategoryName('')
                            }
                          }}
                        />
                        <input
                          type="color"
                          value={newCategoryColor}
                          onChange={e => setNewCategoryColor(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded-lg border border-slate-800 bg-slate-950/50 p-0.5"
                        />
                        <button
                          onClick={() => {
                            const val = newCategoryName.trim()
                            if (!val) return
                            addCategory(val, newCategoryColor)
                            setNewCategoryName('')
                          }}
                          className="rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-accent-blue px-3 py-1.5 text-xs font-semibold hover:bg-accent-blue/20 transition-all cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[300px] pr-1 space-y-1.5">
                        {categories.length === 0 ? (
                          <p className="text-xs italic text-slate-500 text-center py-4">No categories configured yet.</p>
                        ) : (
                          categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-2 rounded-lg bg-slate-950/30 border border-slate-850 px-3 py-2">
                              <span className="h-3 w-3 shrink-0 rounded-full border border-slate-850" style={{ backgroundColor: cat.color }} />
                              <span className="flex-1 text-xs font-semibold text-slate-200">{cat.name}</span>
                              <button
                                onClick={() => deleteCategory(cat.id!)}
                                className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'vault' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 flex flex-col gap-6">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-3">Backup & Import Vault</h3>
                      <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                        All focus data is stored local-only on your device. Export a `.studybackup` container to secure your data or migrate configuration tables.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-5 flex flex-col justify-between hover:border-slate-700/60 transition-all">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Export Study Vault</p>
                            <p className="text-[10px] text-slate-500 mt-1 leading-normal font-medium">Constructs a JSON-based database bundle and triggers downloading.</p>
                          </div>
                          <button
                            onClick={exportStudyBackup}
                            className="w-full mt-5 rounded-lg bg-accent-blue/15 text-accent-blue border border-accent-blue/20 py-2 text-xs font-semibold hover:bg-accent-blue/25 active:scale-95 transition-all cursor-pointer text-center"
                          >
                            Export Backup
                          </button>
                        </div>

                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleFileDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                            isDragging
                              ? 'border-accent-purple bg-accent-purple/10'
                              : 'border-slate-800 bg-slate-950/20 hover:bg-slate-950/40 hover:border-slate-700/60'
                          }`}
                        >
                          <span className="text-2xl mb-1.5">📥</span>
                          <p className="text-xs font-semibold text-slate-300">
                            Drag & drop .studybackup here
                          </p>
                          <p className="text-[10px] text-slate-500 mt-1 leading-normal font-medium">
                            or browse local file storage
                          </p>
                        </div>
                      </div>

                      <input
                        type="file"
                        accept=".studybackup,.json"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const r = new FileReader()
                            r.onload = () => importStudyBackup(r.result as string)
                            r.readAsText(file)
                          }
                          e.target.value = ''
                        }}
                      />
                    </div>

                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 shadow-xl p-5">
                      <h3 className="text-xs font-bold text-red-400 tracking-wider uppercase mb-2">Destructive Database Sweep</h3>
                      <p className="text-xs text-red-300/80 mb-5 leading-relaxed">
                        Resetting is destructive and permanently sweeps out study logs, focus categories, tasks, and settings. This cannot be undone. We advise saving a backup first.
                      </p>
                      <button
                        onClick={() => {
                          if (confirm("DANGER: This will permanently reset all study logs, categories, and configs. Proceed?")) {
                            resetData()
                          }
                        }}
                        className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        Clear & Reset All Data
                      </button>
                    </div>
                  </div>

                  <div className="xl:col-span-1">
                    <div className="rounded-xl border border-slate-800/60 dynamic-card shadow-xl p-5 flex flex-col h-full">
                      <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase mb-4">Recent Sessions</h3>
                      <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-2">
                        {sessionHistory.length === 0 ? (
                          <p className="text-xs italic text-slate-500 text-center py-6">No study sessions recorded today.</p>
                        ) : (
                          [...sessionHistory]
                            .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
                            .slice(0, 10)
                            .map(entry => (
                            <div key={entry.id} className="flex flex-col gap-1 rounded-lg bg-slate-950/30 border border-slate-850 p-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${entry.type === 'study' ? 'bg-accent-blue' : 'bg-accent-amber'}`} />
                                <span className="text-xs font-semibold text-slate-200">{entry.type === 'study' ? 'Study session' : 'Break time'}</span>
                                <span className="ml-auto text-[10px] text-slate-500 font-semibold">{entry.durationMinutes}m</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-semibold mt-1">🕒 {entry.timestamp}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zen Mode Cinematic Sanctuary Overlay */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-[#020408] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 animate-fade-in animate-hrv-pacer">
          {/* Radial focal glow background pulse */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-accent-blue/10 via-accent-purple/10 to-accent-blue/10 blur-3xl opacity-20 animate-zen-breath" />
          </div>

          {/* HTML5 Canvas Ambient Particle Background */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

          {/* Centerpiece Layout */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-8 select-none max-w-md px-6 animate-slide-in-up">
            {/* Cinematic countdown clock */}
            <div className="text-center">
              <p className="text-[11rem] md:text-[14rem] font-extralight tracking-tighter text-white/95 font-mono leading-none select-none drop-shadow-[0_4px_24px_rgba(255,255,255,0.03)]">
                {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-400 mt-3 uppercase tracking-wider font-semibold">
                {timerMode === 'study' ? 'Deep Study' : 'Resting'}
              </p>
            </div>

            {/* Focus Anchor Text */}
            <div className="mt-10 space-y-1">
              {(() => {
                const activeTask = sessionTasks.find(t => t.id === activeTaskId)
                return (
                  <p className="text-lg font-bold text-slate-200 tracking-widest uppercase drop-shadow-[0_0_8px_rgba(59,130,246,0.35)] font-sans">
                    {activeTask ? activeTask.text : 'Radiant Silence'}
                  </p>
                )
              })()}
            </div>

            {/* Play/Pause controls */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => setIsTimerActive(!isTimerActive)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 border border-slate-800 text-accent-blue transition-all hover:bg-slate-800 hover:scale-105 active:scale-95 cursor-pointer"
                title={isTimerActive ? "Pause session" : "Start session"}
              >
                {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={completeSession}
                className="flex items-center gap-2 rounded-full bg-accent-green/15 text-accent-green border border-accent-green/30 px-6 py-3 text-xs font-bold transition-all hover:bg-accent-green/25 active:scale-95 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                Complete Focus
              </button>
            </div>
          </div>

          {/* Minimal exit chevron */}
          {!(localEnforceLockout && isTimerActive && timerMode === 'study') && (
            <button
              onClick={() => setIsZenMode(false)}
              className="absolute top-8 left-8 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/40 border border-slate-800 hover:bg-slate-900 hover:text-text-primary text-slate-400 transition-colors cursor-pointer"
              title="Exit Sanctuary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
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

      {activeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-[#020617]/90 backdrop-blur-xl border border-slate-700/50 rounded-full px-4 py-1.5 shadow-2xl text-[11px] font-mono tracking-wider text-slate-200 animate-slide-down">
          <kbd className="bg-slate-800 text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
        </div>
      )}
    </div>
  )
}

export default App
