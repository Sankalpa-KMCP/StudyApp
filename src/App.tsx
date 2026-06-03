import { useState, useEffect, useRef, useMemo } from 'react'
import { Brain, Flame, Keyboard } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  useTasks,
  useHistory,
  useSettings,
  useTodayLog,
  useCategories,
  updateDailyReflection,
  calculateStreak,
  calculateXpLevel,
  calculateProductivityInsights,
  calculateCategoryBreakdown,
  calculateMonthLogs,
  calculateCalendarHeatmapData,
  calculateSM2
} from './db/hooks'
import { db } from './db/db'
import type { TaskItem } from './db/types'

// Custom audio hook
import { useAmbientSynth } from './hooks/useAmbientSynth'

// Modular Components
import { Sidebar } from './components/Sidebar'
import { FocusSanctuary } from './components/FocusSanctuary'
import { TaskRegistry } from './components/TaskRegistry'
import { AnalyticsStudio } from './components/AnalyticsStudio'
import { ActivityLedger } from './components/ActivityLedger'
import { ControlDeck } from './components/ControlDeck'
import { ZenOverlay } from './components/ZenOverlay'
import { ReflectionModal } from './components/ReflectionModal'

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
    surface: '#08090d',
    surfaceCard: '#12141c',
    surfaceCardRgb: '18, 20, 28',
    accentBlue: '#c5a880',
    accentPurple: '#dcd6cd',
    accentGreen: '#8a7d6d',
    accentAmber: '#e5dec9',
  },
  'cyber-amethyst': {
    surface: '#0a080d',
    surfaceCard: '#15121c',
    surfaceCardRgb: '21, 18, 28',
    accentBlue: '#a855f7',
    accentPurple: '#c084fc',
    accentGreen: '#701a75',
    accentAmber: '#ebd5ff',
  },
  'deep-forest': {
    surface: '#080d09',
    surfaceCard: '#121c14',
    surfaceCardRgb: '18, 28, 20',
    accentBlue: '#22c55e',
    accentPurple: '#4ade80',
    accentGreen: '#14532d',
    accentAmber: '#bbf7d0',
  },
  'ocean-trench': {
    surface: '#080b0d',
    surfaceCard: '#12181c',
    surfaceCardRgb: '18, 24, 28',
    accentBlue: '#0ea5e9',
    accentPurple: '#38bdf8',
    accentGreen: '#0c4a6e',
    accentAmber: '#bae6fd',
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
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

const tooltipStyle = {
  backgroundColor: 'rgba(8, 10, 15, 0.85)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
  color: '#e1ded7',
  outline: 'none',
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
    noiseType,
    binauralTarget,
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

  // Multi-Channel Volume states
  const [localVolumeRain, setLocalVolumeRain] = useState(0.5)
  const [localVolumeCafe, setLocalVolumeCafe] = useState(0.5)
  const [localVolumeWhiteNoise, setLocalVolumeWhiteNoise] = useState(0.5)
  const [localAlphaWaves, setLocalAlphaWaves] = useState(0.0)

  // Guided HRV Breathing state
  const [breathTime, setBreathTime] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathTime(t => (t + 1) % 12)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Zen Mode, Active View Router & Backups Drag/Drop
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'focus' | 'analytics' | 'journal' | 'settings'>('focus')
  const [isDragging, setIsDragging] = useState(false)

  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskCycleCount, setTaskCycleCount] = useState(1)
  const [localTactileFeedback, setLocalTactileFeedback] = useState(false)
  const [activeToast, setActiveToast] = useState<{ key: string; message: string; id: number } | null>(null)
  const [localDeveloperFont, setLocalDeveloperFont] = useState('JetBrains Mono')
  const [localEnforceLockout, setLocalEnforceLockout] = useState(false)
  const [showReflectionModal, setShowReflectionModal] = useState(false)
  const [pendingSessionData, setPendingSessionData] = useState<{ elapsed: number; mode: 'study' | 'break'; timestamp: string; categoryId?: number } | null>(null)
  const [attentionRating, setAttentionRating] = useState(4)
  const [stabilityRating, setStabilityRating] = useState(4)
  const [localSessionNotes, setLocalSessionNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Initialize and invoke custom audio synthesizer hook
  const { playChime } = useAmbientSynth({
    timerMode,
    isTimerActive,
    soundEnabled,
    noiseType,
    binauralTarget,
    rainVol: localVolumeRain,
    cafeVol: localVolumeCafe,
    noiseVol: localVolumeWhiteNoise,
    binauralVol: localAlphaWaves,
    tactileEnabled: localTactileFeedback
  })

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

  incStudyRef.current = incrementStudy
  incBreakRef.current = incrementBreak

  const handleModeSwitchRef = useRef<any>(null)
  const completeSessionRef = useRef<any>(null)

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
  }, [selectedDay, currentMonth, currentYear, selectedDayLog])

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
    const bgBreakMin = log?.breakMinutes ?? 0
    const total = studyMin + bgBreakMin
    const focusRatio = total > 0 ? Math.round((studyMin / total) * 100) : 0
    return {
      date,
      dayName: dayNames[startDay],
      studyTime: formatMinutes(studyMin),
      breakTime: formatMinutes(bgBreakMin),
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

  async function processSessionCompletion(elapsed: number, mode: 'study' | 'break', timestamp: string, categoryId?: number, attRating?: number, stabRating?: number, sessionNotes?: string) {
    await addHistoryEntry({
      timestamp,
      type: mode,
      durationMinutes: Math.floor(elapsed / 60) || 1,
      categoryId: mode === 'study' ? categoryId : undefined,
      sessionNotes: sessionNotes || undefined,
      ...(attRating !== undefined ? { attentionRating: attRating } : {}),
      ...(stabRating !== undefined ? { stabilityRating: stabRating } : {}),
    } as any)
    
    const firstUncompleted = sessionTasks.find(t => !t.completed)
    if (firstUncompleted && firstUncompleted.id !== undefined) {
      await toggleTask(firstUncompleted.id)
    } else {
      await addTask(`Session ${Date.now()}`)
      const allTasks = await db.tasks.orderBy('id').reverse().toArray()
      const justAdded = allTasks[0]
      if (justAdded?.id !== undefined) await toggleTask(justAdded.id)
    }
    playChime()
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
        setTimeout(() => playChime(), 400)
      } else {
        setCompletedSessionsInCycle(nextCount)
        setIsLongBreak(false)
        setTimerMode('break')
      }
    } else {
      setTimerMode('study')
    }
  }

  async function completeSession() {
    if (completingRef.current) return
    completingRef.current = true
    const elapsed = secondsElapsed
    const mode = timerMode
    setIsTimerActive(false)
    setSecondsElapsed(0)
    const now = new Date()
    const timestamp = `${monthNames[now.getMonth()]} ${now.getDate()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    if (mode === 'study') {
      setPendingSessionData({ elapsed, mode, timestamp, categoryId: timerCategoryId })
      setAttentionRating(4)
      setStabilityRating(4)
      setLocalSessionNotes('')
      setShowReflectionModal(true)
      completingRef.current = false
      return
    }

    await processSessionCompletion(elapsed, mode, timestamp, timerCategoryId)
  }

  function handleModeSwitch(mode: 'study' | 'break') {
    if (completingRef.current) return
    if (mode === timerMode) return
    if (mode === 'study') setIsLongBreak(false)
    if (isTimerActive) setIsTimerActive(false)
    setSecondsElapsed(0)
    setTimerMode(mode)
    playChime()
  }

  function handleAddTask(text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high') {
    const trimmed = text.trim()
    if (!trimmed) return
    addTask(trimmed, categoryId, estimatedCycles ?? taskCycleCount, priority)
  }

  async function handleToggleTask(id: number) {
    const task = sessionTasks.find(t => t.id === id)
    if (task) {
      if (!task.completed) {
        playChime()
        await toggleTask(id)
      } else {
        await db.tasks.update(id, { completed: false, nextReviewDate: undefined })
      }
    }
    if (activeTaskId === id) setActiveTaskId(null)
  }

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
      completed: true,
      latestGrade: q
    })
    playChime()
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

  // Timer Tick Interval effect
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

  // Canvas particle background loop
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

      const aggregateVol = (volRainRef.current + volCafeRef.current + volWhiteNoiseRef.current + alphaWavesRef.current)
      const isMuted = aggregateVol <= 0.01

      // Speeds scale directly with sound volume levels
      const speedFactor = isMuted ? 0 : Math.min(2.5, aggregateVol * 1.3)
      const maxDistance = isMuted ? 40 : 100 + Math.min(50, aggregateVol * 30)
      const maxLineAlpha = isMuted ? 0 : Math.min(0.20, aggregateVol * 0.12)

      // 1. Isolate coordinate calculation loop
      particles.forEach(p => {
        if (isMuted) {
          const targetX = width / 2
          const targetY = height / 2
          p.x += (targetX - p.x) * 0.015
          p.y += (targetY - p.y) * 0.015
        } else {
          p.x += p.originalVx * speedFactor
          p.y += p.originalVy * speedFactor

          if (p.x < 0) { p.x = 0; p.originalVx *= -1 }
          else if (p.x > width) { p.x = width; p.originalVx *= -1 }

          if (p.y < 0) { p.y = 0; p.originalVy *= -1 }
          else if (p.y > height) { p.y = height; p.originalVy *= -1 }
        }
      })

      // 2. Draw particle nodes
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = isMuted
          ? 'rgba(255, 255, 255, 0.02)'
          : `rgba(255, 255, 255, ${0.08 + Math.min(0.12, aggregateVol * 0.10)})`
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
              ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`
              ctx.lineWidth = 0.5
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
          { freq: 0.008, speed: 0.8, phase: 0,          color: 'rgba(255, 255, 255, 0.15)',   lineW: 0.75 },
          { freq: 0.012, speed: 1.2, phase: Math.PI / 3, color: 'rgba(255, 255, 255, 0.08)',  lineW: 0.5 },
          { freq: 0.006, speed: -0.6, phase: Math.PI / 1.5, color: 'rgba(255, 255, 255, 0.08)', lineW: 0.5 },
        ]
        layers.forEach((l, idx) => {
          ctx.beginPath()
          ctx.moveTo(0, waveBaseY)
          const freq = l.freq * (1 + aggregateVol * 0.3)
          const amp = waveAmplitudeRef.current * (1 - idx * 0.15)
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
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
  }, [isZenMode, theme])

  handleModeSwitchRef.current = handleModeSwitch
  completeSessionRef.current = completeSession

  // keyboard triggers
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (activeTab === 'settings' || isHotkeyHudOpen) return
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
          if (localEnforceLockout && isTimerActive && timerMode === 'study') {
            setActiveToast({
              key: 'LOCK',
              message: 'LOCKOUT ACTIVE - COMPULSORY STUDY',
              id: Date.now()
            })
            break
          }
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
  }, [activeTab, isHotkeyHudOpen, isTimerActive, timerMode, localEnforceLockout])

  // HUD Toast Auto-Dismissal
  useEffect(() => {
    if (!activeToast) return
    const timer = setTimeout(() => {
      setActiveToast(null)
    }, 1500)
    return () => clearTimeout(timer)
  }, [activeToast])

  async function resetData() {
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
      { key: 'ambient_alphaWaves', value: 0.0 },
      { key: 'noiseType', value: 'white' },
      { key: 'binauralTarget', value: 'alpha' }
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
    setLocalAlphaWaves(0)
    setActiveTaskId(null)
    window.location.reload()
  }

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

  // settings configurations restoration mapping
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

  // session Heartbeat sessionStorage backing
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

  // session Heartbeat restoration on boot
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
            
            await addHistoryEntry({
              timestamp,
              type: shadow.mode,
              durationMinutes: elapsedMin,
              categoryId: shadow.mode === 'study' ? shadow.categoryId : undefined,
            })
            
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

  if (!isDataReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#06070a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <p className="text-sm text-white/50 font-mono tracking-wider">LOADING STUDY DASHBOARD...</p>
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
    '--font-family-override': ['Inter', 'Outfit'].includes(localDeveloperFont) ? `'${localDeveloperFont}', 'Plus Jakarta Sans', system-ui, sans-serif` : `'${localDeveloperFont}', monospace`,
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden" style={inlineStyles}>
      
      {/* iOS 26 Animated Mesh Backdrop Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />
        <div className="mesh-blob mesh-blob-4" />
      </div>

      {/* Collapsible/Floating Glassmorphic Sidebar */}
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={level}
        xpProgressPercent={xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={isTimerActive}
        timerMode={timerMode}
        localEnforceLockout={localEnforceLockout}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 z-10">
        
        {/* Mobile top-bar */}
        {!isZenMode && (
          <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-white animate-pulse" />
                <span className="font-bold text-sm text-white">Study Dashboard</span>
              </div>
              <span className="text-[8px] text-white/40 font-mono tracking-widest font-bold">BY SANKALPA KMCP</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-mono font-bold text-orange-400">{currentStreak}d</span>
              </div>
              <button
                onClick={() => setIsHotkeyHudOpen(true)}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${
          isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''
        }`}>
          {!isZenMode && (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* TAB 1: FOCUS SANCTUARY */}
              {activeTab === 'focus' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start">
                  
                  {/* Left block (Clock & sound configurations) */}
                  <div className="lg:col-span-5">
                    <FocusSanctuary
                      timerMode={timerMode}
                      isTimerActive={isTimerActive}
                      setIsTimerActive={setIsTimerActive}
                      remainingSeconds={remainingSeconds}
                      secondsElapsed={secondsElapsed}
                      progress={progress}
                      isLongBreak={isLongBreak}
                      completedSessionsInCycle={completedSessionsInCycle}
                      targetSessionsPerCycle={targetSessionsPerCycle}
                      handleModeSwitch={handleModeSwitch}
                      completeSession={completeSession}
                      breathTime={breathTime}
                      setIsZenMode={setIsZenMode}
                      soundEnabled={soundEnabled}
                      noiseType={noiseType}
                      binauralTarget={binauralTarget}
                      updateSetting={updateSetting}
                      localVolumeRain={localVolumeRain}
                      setLocalVolumeRain={setLocalVolumeRain}
                      localVolumeCafe={localVolumeCafe}
                      setLocalVolumeCafe={setLocalVolumeCafe}
                      localVolumeWhiteNoise={localVolumeWhiteNoise}
                      setLocalVolumeWhiteNoise={setLocalVolumeWhiteNoise}
                      localAlphaWaves={localAlphaWaves}
                      setLocalAlphaWaves={setLocalAlphaWaves}
                    />
                  </div>

                  {/* Right block (Task list and reviews) */}
                  <div className="lg:col-span-7">
                    <TaskRegistry
                      tasks={sessionTasks}
                      categories={categories}
                      activeTaskId={activeTaskId}
                      setActiveTaskId={setActiveTaskId}
                      toggleTask={handleToggleTask}
                      handleAddTask={handleAddTask}
                      submitRecallGrade={submitRecallGrade}
                      timerCategoryId={timerCategoryId}
                      setTimerCategoryId={setTimerCategoryId}
                      timerMode={timerMode}
                      taskCycleCount={taskCycleCount}
                      setTaskCycleCount={setTaskCycleCount}
                    />
                  </div>

                </div>
              )}

              {/* TAB 2: ANALYTICS STUDIO */}
              {activeTab === 'analytics' && (
                <AnalyticsStudio
                  tasks={sessionTasks}
                  monthLogs={monthLogs}
                  totalMonthHours={totalMonthHours}
                  totalWeeklyBreakHours={totalWeeklyBreakHours}
                  totalDaysInMonth={totalDaysInMonth}
                  currentStreak={currentStreak}
                  level={level}
                  chartData={chartData}
                  categoryBreakdown={categoryBreakdown}
                  topSubject={topSubject}
                  avgMin={avgMin}
                  completionRate={completionRate}
                  peakDay={peakDay}
                  activeThemeVars={activeThemeVars}
                  tooltipStyle={tooltipStyle}
                  hasChartData={hasChartData}
                />
              )}

              {/* TAB 3: ACTIVITY LEDGER */}
              {activeTab === 'journal' && (
                <ActivityLedger
                  selectedDay={selectedDay}
                  setSelectedDay={setSelectedDay}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                  monthNames={monthNames}
                  dayNames={dayNames}
                  goPrevMonth={goPrevMonth}
                  goNextMonth={goNextMonth}
                  calendarCategoryFilter={calendarCategoryFilter}
                  setCalendarCategoryFilter={setCalendarCategoryFilter}
                  categories={categories}
                  activeThemeVars={activeThemeVars}
                  dynamicGridCells={dynamicGridCells}
                  activeMonthData={activeMonthData}
                  isLiveMonth={isLiveMonth}
                  totalDaysInMonth={totalDaysInMonth}
                  todayStudyMinutes={todayStudyMinutes}
                  todayBreakMinutes={todayBreakMinutes}
                  progressPercent={progressPercent}
                  liveDay={liveDay}
                  draftMood={draftMood}
                  handleMoodSelect={handleMoodSelect}
                  draftNotes={draftNotes}
                  handleNotesChange={handleNotesChange}
                  selectedDayHistory={selectedDayHistory}
                  formatMinutes={formatMinutes}
                  getIntensity={getIntensity}
                  hexToRgb={hexToRgb}
                />
              )}

              {/* TAB 4: CONTROL DECK (SETTINGS) */}
              {activeTab === 'settings' && (
                <ControlDeck
                  theme={theme}
                  updateSetting={updateSetting}
                  cardOpacity={cardOpacity}
                  backdropBlur={backdropBlur}
                  soundEnabled={soundEnabled}
                  tactileEnabled={localTactileFeedback}
                  localEnforceLockout={localEnforceLockout}
                  setLocalEnforceLockout={setLocalEnforceLockout}
                  audio_presets={audio_presets}
                  localVolumeRain={localVolumeRain}
                  setLocalVolumeRain={setLocalVolumeRain}
                  localVolumeCafe={localVolumeCafe}
                  setLocalVolumeCafe={setLocalVolumeCafe}
                  localVolumeWhiteNoise={localVolumeWhiteNoise}
                  setLocalVolumeWhiteNoise={setLocalVolumeWhiteNoise}
                  localAlphaWaves={localAlphaWaves}
                  setLocalAlphaWaves={setLocalAlphaWaves}
                  exportStudyBackup={exportStudyBackup}
                  importStudyBackup={importStudyBackup}
                  resetData={resetData}
                  categories={categories}
                  addCategory={addCategory}
                  deleteCategory={deleteCategory}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  newCategoryColor={newCategoryColor}
                  setNewCategoryColor={setNewCategoryColor}
                  localDeveloperFont={localDeveloperFont}
                  setLocalDeveloperFont={setLocalDeveloperFont}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  handleFileDrop={handleFileDrop}
                  fileInputRef={fileInputRef}
                  THEME_PROFILES={THEME_PROFILES}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Zen Mode Cinematic Sanctuary Overlay */}
      <ZenOverlay
        isZenMode={isZenMode}
        canvasRef={canvasRef}
        remainingSeconds={remainingSeconds}
        timerMode={timerMode}
        sessionTasks={sessionTasks}
        activeTaskId={activeTaskId}
        isTimerActive={isTimerActive}
        setIsTimerActive={setIsTimerActive}
        completeSession={completeSession}
        localEnforceLockout={localEnforceLockout}
        setIsZenMode={setIsZenMode}
      />

      {/* Post-Sprint Reflection Modal Gate */}
      <ReflectionModal
        showReflectionModal={showReflectionModal}
        pendingSessionData={pendingSessionData}
        attentionRating={attentionRating}
        setAttentionRating={setAttentionRating}
        stabilityRating={stabilityRating}
        setStabilityRating={setStabilityRating}
        localSessionNotes={localSessionNotes}
        setLocalSessionNotes={setLocalSessionNotes}
        onSubmitReflection={async (att, stab, notes) => {
          setShowReflectionModal(false)
          const data = pendingSessionData
          setPendingSessionData(null)
          completingRef.current = true
          await processSessionCompletion(data!.elapsed, data!.mode, data!.timestamp, data!.categoryId, att, stab, notes)
        }}
      />

      {/* Key Shortcut Deck Modal */}
      {isHotkeyHudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsHotkeyHudOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)]" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button onClick={() => setIsHotkeyHudOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer">
                <X />
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
                <div key={item.keys} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
                  <span className="text-sm text-white/80">{item.action}</span>
                  <kbd className="rounded border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{item.keys}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">Shortcuts are disabled while typing in input fields.</p>
          </div>
        </div>
      )}

      {/* Floating HUD Toast alerts */}
      {activeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-[11px] font-mono tracking-wider text-white animate-slide-down">
          <kbd className="bg-white/10 text-white border border-white/15 rounded px-1.5 py-0.5 text-[9px] font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
        </div>
      )}

    </div>
  )
}

// Simple placeholder close icon helper
const X: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
)

export default App
