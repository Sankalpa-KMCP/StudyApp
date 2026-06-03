import { useState, useEffect, useRef, useMemo } from 'react'
import { Brain, Clock, BarChart3, Target, Flame, Calendar, Award, Coffee, Play, Pause, Check, CheckCircle, Plus, Settings, X, CloudRain, Radio, Keyboard, Trash2, Sparkles, ChevronLeft } from 'lucide-react'
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
    surface: '#080b11',
    surfaceCard: '#101622',
    surfaceCardRgb: '16, 22, 34',
    accentBlue: '#38bdf8',
    accentPurple: '#818cf8',
    accentGreen: '#34d399',
    accentAmber: '#fbbf24',
  },
  'cyber-amethyst': {
    surface: '#0c0714',
    surfaceCard: '#160e25',
    surfaceCardRgb: '22, 14, 37',
    accentBlue: '#f43f5e',
    accentPurple: '#c084fc',
    accentGreen: '#22d3ee',
    accentAmber: '#fb7185',
  },
  'deep-forest': {
    surface: '#070c0a',
    surfaceCard: '#0e1814',
    surfaceCardRgb: '14, 24, 20',
    accentBlue: '#10b981',
    accentPurple: '#a7f3d0',
    accentGreen: '#84cc16',
    accentAmber: '#f59e0b',
  },
  'ocean-trench': {
    surface: '#030914',
    surfaceCard: '#0a1224',
    surfaceCardRgb: '10, 18, 36',
    accentBlue: '#06b6d4',
    accentPurple: '#3b82f6',
    accentGreen: '#2dd4bf',
    accentAmber: '#e11d48',
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

const tooltipStyle = {
  background: '#131926',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '8px',
  outline: 'none',
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
  const [localAlphaWaves, setLocalAlphaWaves] = useState(0.0)

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const volRainRef = useRef(localVolumeRain)
  const volCafeRef = useRef(localVolumeCafe)
  const volWhiteNoiseRef = useRef(localVolumeWhiteNoise)
  const alphaWavesRef = useRef(localAlphaWaves)
  const waveAmplitudeRef = useRef(0)
  const masterGainRef = useRef<GainNode | null>(null)

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

  async function processSessionCompletion(elapsed: number, mode: 'study' | 'break', timestamp: string, categoryId?: number, attRating?: number, stabRating?: number) {
    await addHistoryEntry({
      timestamp,
      type: mode,
      durationMinutes: Math.floor(elapsed / 60),
      categoryId: mode === 'study' ? categoryId : undefined,
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

      // Query volume master gain dynamically
      const masterGain = masterGainRef.current
      const aggregateVol = masterGain ? masterGain.gain.value : (volRainRef.current + volCafeRef.current + volWhiteNoiseRef.current + alphaWavesRef.current)

      const isMuted = aggregateVol <= 0.01

      // Speeds scale directly with sound volume levels
      const speedFactor = isMuted ? 0 : Math.min(2.5, aggregateVol * 1.3)
      const maxDistance = isMuted ? 40 : 100 + Math.min(50, aggregateVol * 30)
      const maxLineAlpha = isMuted ? 0 : Math.min(0.20, aggregateVol * 0.12)

      const activeThemeVars = THEME_PROFILES[theme] || THEME_PROFILES['midnight-slate']
      const accentBlueColor = activeThemeVars.accentBlue
      const accentPurpleColor = activeThemeVars.accentPurple
      const rRgb = hexToRgb(accentBlueColor) || { r: 56, g: 189, b: 248 }
      const pRgb = hexToRgb(accentPurpleColor) || { r: 129, g: 140, b: 248 }

      // 1. Isolate coordinate calculation loop
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
      })

      // 2. Draw particle nodes
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = isMuted
          ? 'rgba(71, 85, 105, 0.3)'
          : `rgba(${rRgb.r}, ${rRgb.g}, ${rRgb.b}, ${0.35 + Math.min(0.35, aggregateVol * 0.15)})`
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
              ctx.strokeStyle = `rgba(${rRgb.r}, ${rRgb.g}, ${rRgb.b}, ${alpha})`
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
          { freq: 0.008, speed: 0.8, phase: 0,          color: `rgba(${rRgb.r}, ${rRgb.g}, ${rRgb.b}, 0.25)`,   lineW: 2.0 },
          { freq: 0.012, speed: 1.2, phase: Math.PI / 3, color: `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.15)`,  lineW: 1.5 },
          { freq: 0.006, speed: -0.6, phase: Math.PI / 1.5, color: `rgba(${rRgb.r}, ${rRgb.g}, ${rRgb.b}, 0.15)`, lineW: 1.0 },
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
  }, [isZenMode, theme])
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
        { id: 'alphaWaves', vol: localAlphaWaves }
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
        const masterGain = audioCtxRef.current.createGain()
        masterGain.connect(audioCtxRef.current.destination)
        masterGainRef.current = masterGain
      }

      const ctx = audioCtxRef.current

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const aggregateVol = tracks.reduce((sum, t) => sum + t.vol, 0)
      if (masterGainRef.current) {
        masterGainRef.current.gain.setValueAtTime(anyActive ? Math.min(1.0, aggregateVol) : 0, ctx.currentTime)
      }

      tracks.forEach(t => {
        const ch = channelsRef.current[t.id]
        const shouldPlay = isStudyActive && t.vol > 0

        if (shouldPlay) {
          if (!ch.source) {
            const gainNode = ctx.createGain()
            gainNode.gain.setValueAtTime(t.vol, ctx.currentTime)
            gainNode.connect(masterGainRef.current || ctx.destination)

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
  }, [activeTab, isHotkeyHudOpen])


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
      { key: 'ambient_alphaWaves', value: 0.0 },
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
    '--font-family-override': ['Inter', 'Outfit'].includes(localDeveloperFont) ? `'${localDeveloperFont}', 'Plus Jakarta Sans', system-ui, sans-serif` : `'${localDeveloperFont}', monospace`,
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-surface font-sans text-text-primary antialiased relative flex flex-col md:flex-row" style={inlineStyles}>
      
      {/* Collapsible/Floating Glassmorphic Sidebar */}
      {!isZenMode && (
        <aside className="w-full md:w-64 shrink-0 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-4 md:p-6 flex flex-col justify-between gap-6 transition-all duration-300 z-20">
          <div className="flex flex-col gap-6">
            
            {/* Branding Logo */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-accent-blue to-accent-purple shadow-lg shadow-accent-blue/20">
                <Brain className="h-5 w-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-text-primary to-accent-blue bg-clip-text text-transparent">Aether</h1>
                <p className="text-[9px] text-slate-450 font-bold tracking-widest font-mono uppercase">Study Sanctuary</p>
              </div>
            </div>

            {/* Streak & Progression Panel */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-orange-500 animate-pulse-soft" />
                  <span className="text-xs font-bold font-mono text-orange-400">{currentStreak} Day Streak</span>
                </div>
                <span className="rounded-lg bg-accent-purple/20 border border-accent-purple/30 px-2 py-0.5 text-[9px] font-extrabold text-accent-purple font-mono tracking-wider">
                  LV. {level}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                  <span>Level Progress</span>
                  <span>{xpProgressPercent}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent-purple transition-all duration-300 shadow-[0_0_8px_var(--color-accent-purple)]"
                    style={{ width: `${xpProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
              {[
                { id: 'focus', label: 'Focus Sanctuary', icon: Clock },
                { id: 'analytics', label: 'Analytics Studio', icon: BarChart3 },
                { id: 'journal', label: 'Activity Ledger', icon: Calendar },
                { id: 'settings', label: 'Control Deck', icon: Settings },
              ].map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                const isLocked = localEnforceLockout && isTimerActive && timerMode === 'study' && tab.id !== 'focus'
                return (
                  <button
                    key={tab.id}
                    disabled={isLocked}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`nav-tab shrink-0 w-full ${isActive ? 'active' : ''} ${isLocked ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400' : 'cursor-pointer'}`}
                    title={isLocked ? "Focus Lockout Active" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Sidebar Footer / Keyboard trigger */}
          <div className="hidden md:flex flex-col gap-3 border-t border-white/5 pt-4">
            <button
              onClick={() => setIsHotkeyHudOpen(true)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-450 hover:bg-white/5 hover:text-text-primary transition-all cursor-pointer"
            >
              <Keyboard className="h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </button>
            <p className="text-[10px] text-slate-555 font-semibold uppercase tracking-wider text-center">
              Aether Engine v1.0
            </p>
          </div>
        </aside>
      )}

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile top-bar */}
        {!isZenMode && (
          <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-black/10">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-accent-blue" />
              <span className="font-bold text-sm bg-gradient-to-r from-text-primary to-accent-blue bg-clip-text text-transparent">Aether</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-mono font-bold text-orange-400">{currentStreak}d</span>
              </div>
              <button
                onClick={() => setIsHotkeyHudOpen(true)}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400"
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
                  
                  {/* Left block (Clock & Soundscapes) - Grid 5 */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="relative overflow-hidden flex flex-col rounded-2xl border border-white/5 dynamic-card p-6">
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-[9px] font-mono tracking-widest text-accent-blue/90 uppercase bg-accent-blue/10 px-2.5 py-0.5 rounded-full border border-accent-blue/20">Focus Session</span>
                        <button
                          onClick={() => setIsZenMode(true)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold border border-accent-purple/30 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-all cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>Sanctuary Mode (Z)</span>
                        </button>
                      </div>

                      {/* Timer Dial Display */}
                      <div className="flex flex-col items-center py-4 border-b border-white/5">
                        <div className="relative flex h-44 w-44 items-center justify-center">
                          <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
                            <circle
                              cx="60" cy="60" r="52"
                              fill="none" stroke="var(--color-accent-blue)"
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray="326.7"
                              strokeDashoffset={String(326.7 * (1 - progress))}
                              style={{
                                stroke: timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)',
                                transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.3s',
                                filter: `drop-shadow(0 0 8px ${timerMode === 'study' ? 'var(--color-accent-blue)' : isLongBreak ? 'var(--color-accent-green)' : 'var(--color-accent-amber)'}40)`
                              }}
                            />
                          </svg>
                          <div className="text-center z-10">
                            <p className="text-4xl font-extrabold text-text-primary font-mono tracking-tight tabular-nums select-none">
                              {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:{String(remainingSeconds % 60).padStart(2, '0')}
                            </p>
                            <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-1 select-none">
                              {timerMode === 'study' ? 'Study Block' : isLongBreak ? 'Long Break' : 'Short Break'}
                            </p>
                          </div>
                        </div>

                        {/* Quick Controls */}
                        <div className="flex items-center gap-3 mt-6">
                          <button
                            onClick={() => handleModeSwitch(timerMode === 'study' ? 'break' : 'study')}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-white/5 bg-white/5 hover:bg-white/10 text-slate-355 hover:text-text-primary transition-all cursor-pointer"
                          >
                            Switch to {timerMode === 'study' ? 'Break' : 'Study'}
                          </button>
                          
                          <button
                            onClick={() => { if (!completingRef.current) setIsTimerActive(a => !a) }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-blue/15 text-accent-blue hover:bg-accent-blue hover:text-slate-950 transition-all active:scale-95 cursor-pointer"
                          >
                            {isTimerActive ? <Pause className="h-4.5 w-4.5" /> : <Play className="h-4.5 w-4.5" />}
                          </button>

                          {(isTimerActive || secondsElapsed > 0) && (
                            <button
                              onClick={completeSession}
                              className="flex items-center gap-1.5 rounded-xl bg-accent-green/15 text-accent-green border border-accent-green/20 px-3.5 py-1.5 text-xs font-bold transition-all hover:bg-accent-green hover:text-slate-950 active:scale-95 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Complete</span>
                            </button>
                          )}
                        </div>

                        {/* Progress Tracker */}
                        <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 font-semibold bg-white/[0.02] border border-white/5 px-3 py-1 rounded-full">
                          <span>Cycle:</span>
                          <div className="flex items-center gap-1" title={`${completedSessionsInCycle} of ${targetSessionsPerCycle} completed`}>
                            {Array.from({ length: targetSessionsPerCycle }, (_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                  i < completedSessionsInCycle
                                    ? 'bg-accent-blue scale-125 shadow-[0_0_4px_var(--color-accent-blue)]'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Ambient Controls */}
                      <div className="mt-5 space-y-3">
                        <p className="text-[10px] font-bold text-slate-450 tracking-wider uppercase">Background Ambience</p>
                        <div className="flex flex-col gap-2">
                          {[
                            { id: 'ambientVolume_rain', label: 'Rain', icon: CloudRain, val: localVolumeRain, colorClass: 'accent-accent-blue', setVal: setLocalVolumeRain, colorName: 'blue' },
                            { id: 'ambientVolume_cafe', label: 'Cafe Ambiance', icon: Coffee, val: localVolumeCafe, colorClass: 'accent-accent-amber', setVal: setLocalVolumeCafe, colorName: 'amber' },
                            { id: 'ambientVolume_whiteNoise', label: 'White Noise', icon: Radio, val: localVolumeWhiteNoise, colorClass: 'accent-accent-purple', setVal: setLocalVolumeWhiteNoise, colorName: 'purple' },
                            { id: 'ambient_alphaWaves', label: 'Alpha Waves', icon: Brain, val: localAlphaWaves, colorClass: 'accent-accent-purple', setVal: setLocalAlphaWaves, colorName: 'purple' },
                          ].map(ch => {
                            const Icon = ch.icon
                            return (
                              <div key={ch.id} className="flex items-center gap-3 bg-[#0c0f17]/45 border border-white/5 rounded-xl px-3 py-2 transition-all">
                                <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="text-xs font-semibold text-slate-350 w-24 shrink-0">{ch.label}</span>
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
                                  className={`flex-1 h-1.5 rounded-full cursor-pointer bg-white/5 outline-none ${ch.colorClass}`}
                                  style={{ '--color-accent-blue': `var(--color-accent-${ch.colorName})` } as React.CSSProperties}
                                />
                                <span className="text-[10px] font-bold text-slate-500 w-7 text-right font-mono">
                                  {Math.round(ch.val * 100)}%
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* HRV Coherence Pacer Card */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-5 animate-hrv-pacer">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-mono tracking-widest text-accent-purple/90 uppercase bg-accent-purple/10 px-2.5 py-0.5 rounded-full border border-accent-purple/20">HRV Resonance</span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">8s Breathe</span>
                      </div>
                      <div className="flex items-center gap-4 bg-[#0c0f17]/40 border border-white/5 px-4 py-3 rounded-xl">
                        <div className="relative flex h-10 w-10 items-center justify-center shrink-0">
                          <div className="absolute inset-0 rounded-full border border-accent-purple/30 animate-zen-breath" />
                          <div className="h-4 w-4 rounded-full bg-accent-purple animate-pulse" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-350 select-none">HRV Coherence Pacer</p>
                          <p className="text-[10px] text-slate-505 leading-normal mt-0.5">Align respiration with the expanding shadow ring (4s inhale / 4s exhale) to optimize autonomic stability.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right block (Task Objectives) - Grid 7 */}
                  <div className="lg:col-span-7 flex flex-col gap-6 h-full">
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col h-full">
                      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                        <div>
                          <h2 className="text-sm font-bold text-slate-200 tracking-wide">Focus Objectives</h2>
                          <p className="text-[10px] text-slate-555 font-semibold mt-0.5">Define and check target objectives</p>
                        </div>
                        
                        {timerMode === 'study' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-450 uppercase font-mono">Active Subject:</span>
                            <select
                              value={timerCategoryId ?? ''}
                              onChange={e => setTimerCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                              className="rounded-xl border border-white/5 bg-black/20 px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent-blue/40 cursor-pointer"
                            >
                              <option value="" className="bg-surface">General</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Active Task Target Indicator */}
                      {activeTaskId !== null && (() => {
                        const activeTask = sessionTasks.find(t => t.id === activeTaskId)
                        if (!activeTask || activeTask.completed) return null
                        return (
                          <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent-blue/20 bg-accent-blue/5 px-4 py-3 animate-slide-in-up">
                            <div className="h-2 w-2 rounded-full bg-accent-blue animate-ping" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-450">Active Target Focus</p>
                              <p className="truncate text-xs font-bold text-accent-blue mt-0.5">{activeTask.text}</p>
                            </div>
                            <span className="whitespace-nowrap text-xs font-mono font-bold text-slate-450 flex items-center gap-1.5 bg-accent-blue/10 px-2.5 py-1 rounded-lg border border-accent-blue/10">
                              <Target className="h-3.5 w-3.5 text-accent-blue" />
                              <span>{activeTask.actualCycles ?? 0}/{activeTask.estimatedCycles ?? 1} Cycles</span>
                            </span>
                          </div>
                        )
                      })()}

                      {/* Add Task Input Form */}
                      <div className="flex flex-wrap items-center gap-2 mb-4 bg-white/[0.01] border border-white/5 p-2 rounded-xl">
                        <input
                          data-task-input
                          type="text"
                          placeholder="What is your next study objective?"
                          className="flex-1 rounded-xl bg-black/20 focus:bg-black/35 px-3.5 py-2 text-xs text-text-primary placeholder:text-slate-500 outline-none transition-all"
                          onKeyDown={(e) => { if (e.key === 'Enter') { const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-cycles]'); handleAddTask((e.target as HTMLInputElement).value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); (e.target as HTMLInputElement).value = '' } }}
                        />
                        <select
                          data-task-category
                          className="w-28 rounded-xl bg-black/20 px-2 py-2 text-xs text-text-primary outline-none cursor-pointer"
                        >
                          <option value="" className="bg-surface">No subject</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-surface">{cat.name}</option>
                          ))}
                        </select>
                        <select
                          data-task-cycles
                          value={taskCycleCount}
                          onChange={e => setTaskCycleCount(Number(e.target.value))}
                          className="w-16 rounded-xl bg-black/20 px-2 py-2 text-xs text-text-primary outline-none cursor-pointer"
                        >
                          {[1,2,3,4,5,6,7,8].map(n => (
                            <option key={n} value={n} className="bg-surface">🎯 {n}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { const input = document.querySelector<HTMLInputElement>('[data-task-input]'); const sel = document.querySelector<HTMLSelectElement>('[data-task-category]'); const step = document.querySelector<HTMLSelectElement>('[data-task-cycles]'); if (input) { handleAddTask(input.value, sel?.value ? Number(sel.value) : undefined, step?.value ? Number(step.value) : undefined); input.value = '' } }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-blue/15 text-accent-blue hover:bg-accent-blue hover:text-slate-950 transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Objectives Scroll List */}
                      <div className="flex-1 overflow-y-auto max-h-[360px] custom-scrollbar flex flex-col gap-1.5 pr-1">
                        {activeTasksList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/5 rounded-2xl bg-black/10 text-center my-2">
                            <span className="text-4xl mb-3 animate-pulse-soft">🎯</span>
                            <p className="text-xs font-bold text-slate-350 max-w-[200px] leading-relaxed">
                              No study objectives set for today.
                            </p>
                            <p className="text-[10px] text-slate-550 max-w-[180px] mt-1.5">
                              Input an objective above to plan your focus session.
                            </p>
                          </div>
                        ) : (
                          activeTasksList.map(task => (
                            <div
                              key={task.id}
                              onClick={() => { if (!task.completed) setActiveTaskId(activeTaskId === task.id ? null : task.id!) }}
                              className={`flex flex-col gap-2 rounded-xl px-4 py-3 transition-all cursor-pointer border border-transparent ${
                                activeTaskId === task.id
                                  ? 'bg-accent-blue/5 border-accent-blue/20 shadow-md shadow-accent-blue/5'
                                  : 'bg-[#0c0f17]/25 hover:bg-[#0c0f17]/40 hover:border-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div
                                  onClick={e => { e.stopPropagation(); handleToggleTask(task.id!) }}
                                  className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-all ${
                                    task.completed ? 'border-accent-blue bg-accent-blue/20 text-accent-blue' : 'border-white/10 bg-black/20 hover:border-white/20'
                                  }`}
                                >
                                  {task.completed && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
                                </div>
                                
                                {task.categoryId !== undefined && categoriesMap.has(task.categoryId) && (
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoriesMap.get(task.categoryId)!.color }} />
                                )}

                                <span className={`flex-1 truncate text-xs font-semibold ${task.completed ? 'text-slate-550 line-through' : 'text-text-primary'}`}>
                                  {task.text}
                                </span>

                                <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-400 flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                  <Target className="h-3 w-3 text-accent-blue" />
                                  <span>{task.actualCycles ?? 0}/{task.estimatedCycles ?? 1} Cycles</span>
                                </span>
                              </div>

                              {/* SM-2 Recall Rating Panel */}
                              {task.completed && (
                                <div className="mt-2 pl-8 border-l-2 border-white/5 flex flex-col gap-2 py-1.5" onClick={e => e.stopPropagation()}>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Rate Active Recall (SM-2 Algorithm)</p>
                                  <div className="flex gap-1.5">
                                    {[0, 1, 2, 3, 4, 5].map(q => (
                                      <button
                                        key={q}
                                        onClick={(e) => { e.stopPropagation(); submitRecallGrade(task, q) }}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-white/5 hover:bg-accent-purple hover:text-slate-950 border border-white/5 hover:border-accent-purple text-slate-350 transition-all cursor-pointer"
                                        title={
                                          q === 0 ? "Complete blackout" :
                                          q === 1 ? "Incorrect but remembered" :
                                          q === 2 ? "Incorrect; easy to recall after checking" :
                                          q === 3 ? "Correct with serious effort" :
                                          q === 4 ? "Correct after hesitation" :
                                          "Perfect recall"
                                        }
                                      >
                                        {q}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ANALYTICS STUDIO */}
              {activeTab === 'analytics' && (
                <div className="flex flex-col gap-6 w-full flex-1 animate-fade-in">
                  
                  {/* Summary Metrics Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Monthly Study Time', value: `${totalMonthHours.toFixed(1)}h`, icon: Clock, iconColor: 'text-accent-blue', bg: 'bg-accent-blue/5' },
                      { label: 'Weekly Break Cooldown', value: `${totalWeeklyBreakHours}h`, icon: Coffee, iconColor: 'text-accent-amber', bg: 'bg-accent-amber/5' },
                      { label: 'Active Study Days', value: `${new Set(monthLogs.filter(l => l.studyMinutes > 0).map(l => l.dateString)).size} / ${totalDaysInMonth}`, icon: Calendar, iconColor: 'text-accent-green', bg: 'bg-accent-green/5' },
                      { label: 'Streak Status', value: `${currentStreak} Days`, icon: Flame, iconColor: 'text-orange-500', bg: 'bg-orange-500/5' },
                    ].map(item => {
                      const Icon = item.icon
                      return (
                        <div key={item.label} className="rounded-2xl border border-white/5 bg-black/20 p-5 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-slate-455 font-bold uppercase tracking-wider">{item.label}</p>
                            <p className="text-xl font-extrabold text-text-primary mt-1 font-mono">{item.value}</p>
                          </div>
                          <div className={`h-11 w-11 rounded-xl flex items-center justify-center border border-white/5 ${item.bg}`}>
                            <Icon className={`h-5 w-5 ${item.iconColor}`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Recharts Performance Trends */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-5">Weekly Performance Trends</h3>
                      {hasChartData ? (
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id="trendsGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={activeThemeVars.accentBlue} stopOpacity={0.3} />
                                  <stop offset="100%" stopColor={activeThemeVars.accentBlue} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                              <Tooltip contentStyle={tooltipStyle} />
                              <Area type="monotone" dataKey="hours" stroke={activeThemeVars.accentBlue} strokeWidth={2.5} fill="url(#trendsGrad)" dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex h-[220px] items-center justify-center">
                          <p className="text-xs text-slate-500 italic">No study hours logged for this period.</p>
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-4 rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-5">Daily Efficiency Index</h3>
                        {hasChartData ? (
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={activeThemeVars.accentBlue} />
                                    <stop offset="100%" stopColor={activeThemeVars.accentPurple} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={true} vertical={false} />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} />
                                <YAxis hide />
                                <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, 'Efficiency']} />
                                <Bar dataKey="focus" fill="url(#effGrad)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex h-[200px] items-center justify-center">
                            <p className="text-xs text-slate-500 italic">No activity indexes logged.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subject Breakdown & Insights */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-5">Subject Distribution</h3>
                      {categoryBreakdown.length > 0 ? (
                        <div className="flex items-center gap-8 justify-around">
                          <div className="w-32 h-32 shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={categoryBreakdown}
                                  dataKey="hours"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={32}
                                  outerRadius={48}
                                  paddingAngle={4}
                                  stroke="none"
                                >
                                  {categoryBreakdown.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-col gap-2.5 flex-1 max-w-[220px]">
                            {categoryBreakdown.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs font-semibold">
                                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-text-primary flex-1 truncate">{item.name}</span>
                                <span className="text-slate-400 font-mono">{item.hours}h</span>
                                <span className="text-slate-500 font-mono text-[10px]">({item.percentage}%)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="py-12 text-center text-xs italic text-slate-500">
                          Configure categories and complete focus blocks to display breakdowns.
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-6 rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-5">Productivity Metrics</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'TOP SUBJECT', value: topSubject || 'No logs', icon: Award, color: 'text-accent-purple', bg: 'bg-accent-purple/5' },
                          { label: 'AVG SESSION LENGTH', value: `${avgMin} min`, icon: Clock, color: 'text-accent-blue', bg: 'bg-accent-blue/5' },
                          { label: 'COMPLETION RATIO', value: `${completionRate}%`, icon: CheckCircle, color: 'text-accent-green', bg: 'bg-accent-green/5' },
                          { label: 'PEAK WORKDAY', value: peakDay || 'No logs', icon: Calendar, color: 'text-accent-amber', bg: 'bg-accent-amber/5' },
                        ].map(insight => {
                          const Icon = insight.icon
                          return (
                            <div key={insight.label} className="rounded-xl border border-white/5 bg-[#0c0f17]/40 p-4 hover:border-white/10 transition-all flex items-center gap-4">
                              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${insight.bg}`}>
                                <Icon className={`h-4.5 w-4.5 ${insight.color}`} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-bold tracking-wider text-slate-450 uppercase">{insight.label}</p>
                                <p className="text-sm font-extrabold text-text-primary truncate mt-0.5">{insight.value}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ACTIVITY LEDGER */}
              {activeTab === 'journal' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
                  
                  {/* Left Block (Calendar & Heatmap) - Grid 5 */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-[9px] font-mono tracking-widest text-accent-amber/90 uppercase bg-accent-amber/10 px-2.5 py-0.5 rounded-full border border-accent-amber/20">Activity Ledger</span>
                      </div>
                      
                      {/* Calendar Navigation header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-accent-blue" />
                          <span className="text-sm font-bold text-slate-200">{monthNames[currentMonth]} {currentYear}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={goPrevMonth} className="h-7 w-7 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold transition-all flex items-center justify-center cursor-pointer">‹</button>
                          <button onClick={goNextMonth} className="h-7 w-7 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-bold transition-all flex items-center justify-center cursor-pointer">›</button>
                          <select
                            value={calendarCategoryFilter === 'all' ? 'all' : String(calendarCategoryFilter)}
                            onChange={e => setCalendarCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="rounded-xl border border-white/5 bg-black/25 px-2.5 py-1 text-xs text-text-secondary outline-none cursor-pointer"
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
                          <div key={d} className="text-[9px] font-bold text-slate-550 uppercase tracking-widest">{d}</div>
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
                                className={`aspect-square rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                                  cell === selectedDay
                                    ? 'ring-2 ring-accent-blue text-text-primary scale-110 z-10 shadow-md shadow-accent-blue/15'
                                    : 'hover:ring-1 hover:ring-accent-blue/30'
                                }`}
                                style={cell === selectedDay ? { backgroundColor: activeThemeVars.accentBlue, color: '#080b11' } : getIntensityStyle(intensity)}
                              >
                                {cell}
                              </button>
                            ) : (
                              <div key={i} className="aspect-square" />
                            )
                          })
                        })()}
                      </div>

                      {/* Legend scale */}
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[9px] text-slate-550 border-t border-white/5 pt-4">
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
                              { label: '0-1h', intensity: 0 },
                              { label: '1-2h', intensity: 1 },
                              { label: '2-3h', intensity: 2 },
                              { label: '3+h', intensity: 3 },
                            ].map(item => (
                              <div key={item.label} className="flex items-center gap-1 font-bold">
                                <div className="h-2.5 w-2.5 rounded-md border border-white/5" style={getIntensityStyle(item.intensity as any)} />
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
                        <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] font-bold text-slate-505 uppercase block">Study block</span>
                          <span className="text-base font-extrabold text-accent-blue mt-0.5 font-mono">{liveDay.studyTime}</span>
                        </div>
                        <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] font-bold text-slate-505 uppercase block">Break cooldown</span>
                          <span className="text-base font-extrabold text-accent-amber mt-0.5 font-mono">{liveDay.breakTime}</span>
                        </div>
                        <div className="bg-white/[0.01] p-3 rounded-xl border border-white/5">
                          <span className="text-[9px] font-bold text-slate-505 uppercase block">Efficiency score</span>
                          <span className="text-base font-extrabold text-accent-green mt-0.5 font-mono">{liveDay.focusScore}</span>
                        </div>
                      </div>

                      {/* Mood calibration deck */}
                      <div className="mb-4">
                        <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-2">Track Mood</p>
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
                                onClick={() => handleMoodSelect(m.value)}
                                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-accent-blue/30 bg-accent-blue/15 text-accent-blue shadow-md'
                                    : 'border-white/5 bg-[#0c0f17]/40 text-slate-455 hover:border-white/10 hover:text-text-primary'
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
                      <div className="mb-4">
                        <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-2">Reflection log</p>
                        <textarea
                          value={draftNotes}
                          onChange={e => handleNotesChange(e.target.value)}
                          placeholder="How did you perform? Note down any wins, hurdles, or focal points for today..."
                          rows={3}
                          className="w-full resize-none rounded-xl border border-white/5 bg-[#0c0f17]/40 focus:bg-black/20 focus:border-accent-blue/40 px-3.5 py-3 text-xs text-text-primary placeholder:text-slate-550 outline-none transition-all duration-200"
                        />
                      </div>

                      {/* Visual 24h study timeline */}
                      <div className="border-t border-white/5 pt-4">
                        <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mb-2.5">Focus Horizon Timeline (24h)</p>
                        <div className="relative w-full bg-black/10 border border-white/5 rounded-2xl p-4">
                          <div className="relative h-6 w-full bg-black/30 rounded-xl border border-white/5 overflow-hidden">
                            <div className="absolute inset-0 flex justify-between pointer-events-none text-[8px] text-slate-700 font-mono">
                              <div className="h-full border-r border-white/5" style={{ left: '25%' }} />
                              <div className="h-full border-r border-white/5" style={{ left: '50%' }} />
                              <div className="h-full border-r border-white/5" style={{ left: '75%' }} />
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
                                  className="absolute top-0 h-full rounded-md transition-all hover:scale-y-110 cursor-pointer"
                                  style={{
                                    left: `${startPercent}%`,
                                    width: `${widthPercent}%`,
                                    backgroundColor: isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber,
                                    boxShadow: `0 0 6px ${isStudy ? activeThemeVars.accentBlue : activeThemeVars.accentAmber}50`
                                  }}
                                />
                              )
                            })}
                          </div>
                          <div className="flex justify-between text-[8px] text-slate-555 font-mono mt-1.5 px-1 select-none">
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
              )}

              {/* TAB 4: CONTROL DECK (SETTINGS) */}
              {activeTab === 'settings' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
                  
                  {/* Left settings pane - Grid 8 */}
                  <div className="xl:col-span-8 flex flex-col gap-6">
                    
                    {/* Visual Themes profile */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-4">Workspace Theme Profiles</h3>
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
                                  ? 'border-accent-blue bg-accent-blue/5 shadow-md'
                                  : 'border-white/5 bg-[#0c0f17]/40 hover:border-white/10 hover:bg-[#0c0f17]/65'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3 w-full">
                                <span className="text-xs font-bold text-slate-200">{displayName}</span>
                                {isSelected && (
                                  <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-accent-blue text-slate-950">
                                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2 text-slate-400">
                                <span className="h-4.5 w-4.5 rounded-full border border-white/5" style={{ backgroundColor: profile.surface }} title="Background" />
                                <span className="h-4.5 w-4.5 rounded-full border border-white/5" style={{ backgroundColor: profile.surfaceCard }} title="Cards" />
                                <div className="h-4 w-px bg-white/10" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentBlue }} title="Primary" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentPurple }} title="Secondary" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentGreen }} title="Cycle break" />
                                <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentAmber }} title="Intermission" />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Translucency sliders */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-5">Translucency & Backdrop Blur Frosting</h3>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-350">Card Backdrop Opacity</span>
                            <span className="text-xs font-bold text-accent-blue">{Math.round(cardOpacity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.20"
                            max="0.90"
                            step="0.05"
                            value={cardOpacity}
                            onChange={e => updateSetting('cardOpacity', parseFloat(e.target.value))}
                            className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-white/5 outline-none"
                          />
                          <div className="mt-1 flex justify-between text-[9px] text-slate-500 font-semibold uppercase">
                            <span>Max Translucency</span>
                            <span>Solid background</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-semibold text-slate-350">Frosting blur size</span>
                            <span className="text-xs font-bold text-accent-blue">{backdropBlur}px</span>
                          </div>
                          <input
                            type="range"
                            min="4"
                            max="24"
                            step="1"
                            value={backdropBlur}
                            onChange={e => updateSetting('backdropBlur', parseInt(e.target.value))}
                            className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-white/5 outline-none"
                          />
                          <div className="mt-1 flex justify-between text-[9px] text-slate-500 font-semibold uppercase">
                            <span>Sharp layout</span>
                            <span>Heavy blur</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Calibration controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-3">Sound completions</h3>
                          <p className="text-xs text-slate-505 leading-relaxed">Play chime ring when focus study cycles complete</p>
                        </div>
                        <div className="flex items-center justify-between mt-4 bg-[#0c0f17]/40 border border-white/5 px-4 py-2.5 rounded-xl">
                          <span className="text-xs font-semibold text-slate-350">Status: {soundEnabled ? 'Enabled' : 'Muted'}</span>
                          <button
                            onClick={() => updateSetting('soundEnabled', !soundEnabled)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${soundEnabled ? 'bg-accent-blue' : 'bg-white/5 border border-white/5'}`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-3">Zen lock boundaries</h3>
                          <p className="text-xs text-slate-505 leading-relaxed">Enforce boundaries: Hides exit navigation controls inside active study blocks</p>
                        </div>
                        <div className="flex items-center justify-between mt-4 bg-[#0c0f17]/40 border border-white/5 px-4 py-2.5 rounded-xl">
                          <span className="text-xs font-semibold text-slate-350">Status: {localEnforceLockout ? 'Active' : 'Bypassed'}</span>
                          <button
                            onClick={() => {
                              const nextVal = !localEnforceLockout
                              setLocalEnforceLockout(nextVal)
                              updateSetting('enforce_lockout', nextVal)
                            }}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-all cursor-pointer ${localEnforceLockout ? 'bg-accent-purple animate-pulse-soft' : 'bg-white/5 border border-white/5'}`}
                          >
                            <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${localEnforceLockout ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Environment preset creator */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-4">Environment Sound Presets</h3>
                      <div className="space-y-4 mb-4 pb-4 border-b border-white/5">
                        <p className="text-xs text-slate-505">Save your active environmental audio track volume mixes as a dynamic profile preset.</p>
                        <div className="flex gap-2">
                          <input
                            id="preset-name-input"
                            type="text"
                            placeholder="Preset Label (e.g. Rainy Cafe Study)"
                            className="flex-1 rounded-xl border border-white/5 bg-[#0c0f17]/40 focus:bg-black/20 focus:border-accent-blue/40 px-3.5 py-2 text-xs text-text-primary outline-none transition-all"
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value?.trim()
                                if (!val) return
                                const newPreset = {
                                  id: Date.now(),
                                  name: val,
                                  volumes: { rain: localVolumeRain, cafe: localVolumeCafe, whiteNoise: localVolumeWhiteNoise, alphaWaves: localAlphaWaves }
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
                                volumes: { rain: localVolumeRain, cafe: localVolumeCafe, whiteNoise: localVolumeWhiteNoise, alphaWaves: localAlphaWaves }
                              }
                              updateSetting('audio_presets', [...audio_presets, newPreset])
                              if (el) el.value = ''
                            }}
                            className="rounded-xl bg-accent-blue text-slate-950 border border-accent-blue px-4 py-2 text-xs font-bold hover:bg-accent-blue/90 transition-all cursor-pointer"
                          >
                            Save Preset
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Presets</p>
                        {audio_presets.length === 0 ? (
                          <p className="text-xs italic text-slate-500 py-2">No custom environmental presets created yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {audio_presets.map((preset: any) => (
                              <div
                                key={preset.id}
                                className="flex items-center justify-between rounded-xl bg-[#0c0f17]/40 border border-white/5 p-3 hover:border-white/10 group transition-all"
                              >
                                <div
                                  className="flex-1 cursor-pointer min-w-0"
                                  onClick={() => {
                                    const vols = preset.volumes || {}
                                    if (vols.rain !== undefined) { setLocalVolumeRain(vols.rain); updateSetting('ambientVolume_rain', vols.rain) }
                                    if (vols.cafe !== undefined) { setLocalVolumeCafe(vols.cafe); updateSetting('ambientVolume_cafe', vols.cafe) }
                                    if (vols.whiteNoise !== undefined) { setLocalVolumeWhiteNoise(vols.whiteNoise); updateSetting('ambientVolume_whiteNoise', vols.whiteNoise) }
                                    if (vols.alphaWaves !== undefined) { setLocalAlphaWaves(vols.alphaWaves); updateSetting('ambient_alphaWaves', vols.alphaWaves) }
                                  }}
                                >
                                  <p className="text-xs font-bold text-slate-200 truncate">{preset.name}</p>
                                  <p className="text-[9px] text-slate-500 mt-1 font-mono font-bold">
                                    🌧️ {Math.round((preset.volumes?.rain ?? 0) * 100)}% · 
                                    ☕ {Math.round((preset.volumes?.cafe ?? 0) * 100)}% · 
                                    📻 {Math.round((preset.volumes?.whiteNoise ?? 0) * 100)}%
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    const filtered = audio_presets.filter((p: any) => p.id !== preset.id)
                                    updateSetting('audio_presets', filtered)
                                  }}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Backups & resets */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-3">Backup Vault container</h3>
                      <p className="text-xs text-slate-505 mb-5 leading-relaxed">
                        Export backup data bundle to sync tables or local study logs across devices.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-white/5 bg-[#0c0f17]/40 p-4 flex flex-col justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-300 block">Export backup vault</span>
                            <span className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Prepares a JSON study logs package and initiates browser download.</span>
                          </div>
                          <button
                            onClick={exportStudyBackup}
                            className="w-full mt-4 rounded-xl bg-accent-blue text-slate-950 border border-accent-blue py-2 text-xs font-bold hover:bg-accent-blue/90 transition-all cursor-pointer"
                          >
                            Export Vault
                          </button>
                        </div>

                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                          onDragLeave={() => setIsDragging(false)}
                          onDrop={handleFileDrop}
                          onClick={() => fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer min-h-[120px] ${
                            isDragging
                              ? 'border-accent-purple bg-accent-purple/10'
                              : 'border-white/5 bg-[#0c0f17]/40 hover:border-white/10'
                          }`}
                        >
                          <span className="text-2xl mb-1.5">📥</span>
                          <span className="text-xs font-bold text-slate-300">Drag backup here</span>
                          <span className="text-[9px] text-slate-505 mt-0.5">or browse files to restore</span>
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

                      <div className="mt-6 border-t border-red-500/15 pt-5">
                        <span className="text-xs font-bold text-red-400 block mb-1">Destructive reset zone</span>
                        <p className="text-xs text-red-300/60 leading-normal mb-4">Clearing parameters sweeps databases and settings completely. Export backup first to protect data.</p>
                        <button
                          onClick={() => {
                            if (confirm("DANGER: Sweeping tables deletes your stats permanently. Reset?")) {
                              resetData()
                            }
                          }}
                          className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-95 transition-all cursor-pointer"
                        >
                          Clear & Reset Workspace Data
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right settings column - Grid 4 */}
                  <div className="xl:col-span-4 flex flex-col gap-6">
                    
                    {/* Subject category customizer */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-4">Subject Categories</h3>
                      
                      <div className="flex gap-2 mb-4 bg-white/[0.01] border border-white/5 p-2 rounded-xl">
                        <input
                          value={newCategoryName}
                          onChange={e => setNewCategoryName(e.target.value)}
                          type="text"
                          placeholder="Label (e.g. Science)"
                          className="flex-1 rounded-xl bg-black/20 px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-550 outline-none transition-all"
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
                          className="h-8 w-8 cursor-pointer rounded-xl border border-white/5 bg-[#0c0f17] p-0.5"
                        />
                        <button
                          onClick={() => {
                            const val = newCategoryName.trim()
                            if (!val) return
                            addCategory(val, newCategoryColor)
                            setNewCategoryName('')
                          }}
                          className="rounded-xl bg-accent-blue/15 border border-accent-blue/20 text-accent-blue px-3 py-1.5 text-xs font-bold hover:bg-accent-blue/20 transition-all cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
                        {categories.length === 0 ? (
                          <p className="text-xs italic text-slate-500 text-center py-4">No categories configured yet.</p>
                        ) : (
                          categories.map(cat => (
                            <div key={cat.id} className="flex items-center gap-2.5 rounded-xl bg-[#0c0f17]/40 border border-white/5 px-3 py-2">
                              <span className="h-3 w-3 shrink-0 rounded-full border border-white/5" style={{ backgroundColor: cat.color }} />
                              <span className="flex-1 text-xs font-bold text-slate-350 truncate">{cat.name}</span>
                              <button
                                onClick={() => deleteCategory(cat.id!)}
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Font Calibration tab */}
                    <div className="rounded-2xl border border-white/5 dynamic-card p-6">
                      <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-4">Typography Overrides</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-2">Primary font override</label>
                          <select
                            value={localDeveloperFont}
                            onChange={e => {
                              const val = e.target.value
                              setLocalDeveloperFont(val)
                              updateSetting('developer_font', val)
                            }}
                            className="w-full rounded-xl border border-white/5 bg-[#0c0f17] px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-blue/40 cursor-pointer"
                          >
                            <option value="Outfit">Outfit (Geometric display)</option>
                            <option value="Inter">Inter (Sans-serif display)</option>
                            <option value="JetBrains Mono">JetBrains Mono (Console default)</option>
                            <option value="Fira Code">Fira Code (Ligature style)</option>
                            <option value="SF Mono">SF Mono (System default)</option>
                          </select>
                          <p className="mt-2 text-[10px] text-slate-550 font-semibold leading-normal">
                            Custom font changes map instantly. Useful for aligning study dashboards with developer workspaces.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Zen Mode Cinematic Sanctuary Overlay */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-[#020408] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-1000 animate-fade-in animate-hrv-pacer">
          {/* Radial focal glow background pulse */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-accent-blue/5 via-accent-purple/5 to-accent-blue/5 blur-3xl opacity-30 animate-zen-breath" />
          </div>

          {/* HTML5 Canvas Ambient Particle Background */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

          {/* Centerpiece Layout */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-8 select-none max-w-md px-6 animate-slide-in-up">
            {/* Cinematic countdown clock */}
            <div className="text-center">
              <p
                className="text-[11rem] md:text-[14rem] text-accent-blue font-mono tracking-tighter leading-none select-none"
                style={{ filter: `drop-shadow(0 0 15px ${activeThemeVars.accentBlue}60)` }}
              >
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
                  <p
                    className="text-lg font-bold text-slate-200 tracking-widest uppercase font-sans"
                    style={{ filter: `drop-shadow(0 0 8px ${activeThemeVars.accentBlue}50)` }}
                  >
                    {activeTask ? activeTask.text : 'Radiant Silence'}
                  </p>
                )
              })()}
            </div>

            {/* Play/Pause controls */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => setIsTimerActive(!isTimerActive)}
                className="flex h-12 w-12 items-center justify-center rounded-sm bg-accent-blue text-slate-950 border border-accent-blue hover:bg-accent-blue/90 active:scale-95 cursor-pointer"
                title={isTimerActive ? "Pause session" : "Start session"}
              >
                {isTimerActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <button
                onClick={completeSession}
                className="flex items-center gap-2 rounded-sm bg-accent-blue text-slate-950 border border-accent-blue px-6 py-3 text-xs font-bold hover:bg-accent-blue/90 active:scale-95 cursor-pointer"
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
              className="absolute top-8 left-8 flex h-10 w-10 items-center justify-center rounded-sm bg-[#0c0f17] border border-[#1b2333] hover:bg-[#0c0f17] text-[#64748b] transition-colors cursor-pointer"
              title="Exit Sanctuary"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
      {showReflectionModal && pendingSessionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative w-full max-w-md border border-[#1b2333] bg-[#0c0f17] rounded-none p-6 animate-slide-in-up">
            <div className="mb-4 pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold tracking-wider uppercase text-accent-amber font-mono">FLOW SESSION REFLECTION</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-1">Telemetry validation required for interval log archiving</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wide mb-2.5 font-mono">1. Internal Attention Focus</label>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      onClick={() => setAttentionRating(rating)}
                      className={`flex-1 py-2 text-xs font-bold border transition-all rounded-none cursor-pointer ${attentionRating === rating ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/50' : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/10'}`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-555 mt-1 font-semibold">
                  <span>Highly Distracted</span>
                  <span>Flow State</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-350 uppercase tracking-wide mb-2.5 font-mono">2. Context-Switching Stability</label>
                <div className="flex gap-2.5">
                  {[1, 2, 3, 4, 5].map(rating => (
                    <button
                      key={rating}
                      onClick={() => setStabilityRating(rating)}
                      className={`flex-1 py-2 text-xs font-bold border transition-all rounded-none cursor-pointer ${stabilityRating === rating ? 'bg-accent-purple/15 text-accent-purple border-accent-purple/50' : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/10'}`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-555 mt-1 font-semibold">
                  <span>Erratic/Fragmented</span>
                  <span>Highly Resolute</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  setShowReflectionModal(false)
                  const data = pendingSessionData
                  setPendingSessionData(null)
                  completingRef.current = true
                  await processSessionCompletion(data.elapsed, data.mode, data.timestamp, data.categoryId, attentionRating, stabilityRating)
                }}
                className="w-full py-3 text-xs font-extrabold uppercase tracking-widest bg-accent-green text-slate-950 hover:bg-accent-green/90 transition-all rounded-none cursor-pointer"
              >
                Log Workstation Telemetry
              </button>
            </div>
          </div>
        </div>
      )}

      {isHotkeyHudOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsHotkeyHudOpen(false)}>
          <div className="absolute inset-0 bg-black/60 " />
          <div className="relative w-full max-w-sm rounded-sm border border-[#1b2333] bg-[#0c0f17] p-5" onClick={e => e.stopPropagation()}>
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
                <div key={item.keys} className="flex items-center justify-between rounded-sm border border-[#1b2333] bg-[#07090e] px-4 py-3">
                  <span className="text-sm text-text-primary">{item.action}</span>
                  <kbd className="rounded border border-[#1b2333] bg-surface px-2 py-0.5 font-mono text-[10px] font-bold uppercase">{item.keys}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400">Shortcuts are disabled while typing in input fields.</p>
          </div>
        </div>
      )}

      {activeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-[#07090e] border border-[#1b2333] rounded-full px-4 py-1.5 text-[11px] font-mono tracking-wider text-slate-200 animate-slide-down">
          <kbd className="bg-[#1b2333] text-slate-400 border border-[#1b2333] rounded px-1.5 py-0.5 text-[9px] font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
        </div>
      )}
    </div>
  )
}

export default App
