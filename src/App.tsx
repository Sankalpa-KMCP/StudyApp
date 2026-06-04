import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { Brain, Flame, Keyboard } from 'lucide-react'
import {
  useTasks,
  useHistory,
  useSettings,
  useTodayLog,
  useCategories,
  useAllDailyLogs,
  updateDailyReflection,
  useFlashcards,
  useQuickNotes,
} from './db/hooks'
import { db } from './db/db'
import {
  hexToRgb,
  formatMinutes,
  getIntensity,
  calculateStreak,
  calculateXpLevel,
  calculateProductivityInsights,
  calculateCategoryBreakdown,
  calculateCalendarHeatmapData,
} from './lib/studyDashboard'
import { THEME_PROFILES, TOOLTIP_STYLE } from './lib/theme'
import type { ActiveTab, ToastState } from './types/app'

import { useAmbientSynth } from './hooks/useAmbientSynth'
import { useSessionBackup } from './hooks/useSessionBackup'
import { useTimerEngine } from './hooks/useTimerEngine'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useZenCanvas } from './hooks/useZenCanvas'
import { useCalendarData } from './hooks/useCalendarData'

import { Sidebar } from './components/Sidebar'
import { FocusSanctuary } from './components/FocusSanctuary'
import { TaskRegistry } from './components/TaskRegistry'
import { ActivityLedger } from './components/ActivityLedger'
import { ControlDeck } from './components/ControlDeck'
import { ZenOverlay } from './components/ZenOverlay'
import { ReflectionModal } from './components/ReflectionModal'
import { FlashcardStudio } from './components/FlashcardStudio'
import { QuickNotesDrawer } from './components/QuickNotesDrawer'
import { HotkeyModal } from './components/HotkeyModal'
import { MobileTabBar } from './components/MobileTabBar'

const AnalyticsStudio = lazy(() =>
  import('./components/AnalyticsStudio').then(m => ({ default: m.AnalyticsStudio }))
)

function App() {
  const { tasks: sessionTasks, addTask, toggleTask, isLoading: tasksLoading } = useTasks()
  const { history: sessionHistory, addEntry: addHistoryEntry, isLoading: historyLoading } = useHistory()
  const {
    dailyGoalMinutes,
    soundEnabled,
    updateSetting,
    targetSessionsPerCycle,
    longBreakDurationMinutes,
    shortBreakDurationMinutes,
    studyBlockDurationMinutes,
    theme,
    cardOpacity,
    backdropBlur,
    tactile_feedback,
    developer_font,
    enforce_lockout,
    initialEasinessFactor,
    autoArchiveAncientTasks,
    isLoading: settingsLoading,
  } = useSettings()

  const { studyMinutes: todayStudyMinutes, breakMinutes: todayBreakMinutes, incrementStudy, incrementBreak, isLoading: todayLogLoading } = useTodayLog()
  const { flashcards, addFlashcard, deleteFlashcard, submitFlashcardGrade, isLoading: flashcardsLoading } = useFlashcards()
  const { notes: quickNotes, addNote: addQuickNote, updateNote: updateQuickNote, deleteNote: deleteQuickNote, isLoading: quickNotesLoading } = useQuickNotes()
  const { categories, isLoading: categoriesLoading, addCategory, deleteCategory } = useCategories()
  const { allLogs, isLoading: allLogsLoading } = useAllDailyLogs()

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear())
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<'all' | number>('all')
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate())
  const [breathTime, setBreathTime] = useState(0)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('focus')
  const [isDragging, setIsDragging] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [taskCycleCount, setTaskCycleCount] = useState(1)
  const [activeToast, setActiveToast] = useState<ToastState | null>(null)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const notesRef = useRef('')
  const moodRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDataReady = !(tasksLoading || historyLoading || settingsLoading || todayLogLoading || allLogsLoading || categoriesLoading || flashcardsLoading || quickNotesLoading)

  const pushToast = (key: string, message: string) => {
    setActiveToast({ key, message, id: Date.now() })
  }

  const backup = useSessionBackup(pushToast)
  const { playChime, ensureAudio } = useAmbientSynth({
    soundEnabled,
    tactileEnabled: tactile_feedback,
  })

  const timer = useTimerEngine({
    isDataReady,
    studyBlockDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    targetSessionsPerCycle,
    initialEasinessFactor,
    incrementStudy,
    incrementBreak,
    addHistoryEntry,
    playChime,
    createDatabaseSnapshot: backup.createDatabaseSnapshot,
    pushToast,
    activeTaskId,
    setActiveTaskId,
  })

  useZenCanvas(isZenMode, canvasRef)

  useKeyboardShortcuts({
    activeTab,
    isHotkeyHudOpen,
    isTimerActive: timer.isTimerActive,
    timerMode: timer.timerMode,
    enforceLockout: enforce_lockout,
    completingRef: timer.completingRef,
    handleModeSwitch: timer.handleModeSwitch,
    completeSession: timer.completeSession,
    setIsTimerActive: timer.setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setActiveToast,
  })

  useEffect(() => {
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${developer_font}', monospace`)
  }, [developer_font])

  const currentStreak = useMemo(() => calculateStreak(allLogs), [allLogs])
  const xpData = useMemo(() => calculateXpLevel(allLogs), [allLogs])
  const insights = useMemo(
    () => calculateProductivityInsights(sessionHistory, sessionTasks, allLogs, categories),
    [sessionHistory, sessionTasks, allLogs, categories],
  )
  const breakdownData = useMemo(
    () => calculateCategoryBreakdown(sessionHistory, categories),
    [sessionHistory, categories],
  )
  const categoryDayMinutes = useMemo(
    () => calculateCalendarHeatmapData(sessionHistory, currentMonth, currentYear, calendarCategoryFilter),
    [sessionHistory, currentMonth, currentYear, calendarCategoryFilter],
  )

  const calendar = useCalendarData({
    allLogs,
    sessionHistory,
    sessionTasks,
    categories,
    currentMonth,
    currentYear,
    selectedDay,
    calendarCategoryFilter,
    dailyGoalMinutes,
    studyBlockDurationMinutes,
    todayStudyMinutes,
    todayBreakMinutes,
    categoryDayMinutes,
  })

  useEffect(() => {
    notesRef.current = calendar.selectedDayLog?.notes ?? ''
    moodRef.current = calendar.selectedDayLog?.mood ?? ''
  }, [calendar.selectedDateStr, calendar.selectedDayLog])

  const progress = dailyGoalMinutes > 0 ? Math.min(todayStudyMinutes / dailyGoalMinutes, 1) : 0

  useEffect(() => {
    if (!activeToast) return
    const duration = activeToast.key === 'LEVEL UP' ? 4000 : 1500
    const t = setTimeout(() => setActiveToast(null), duration)
    return () => clearTimeout(t)
  }, [activeToast])

  const prevLevelRef = useRef<number | null>(null)
  useEffect(() => {
    if (isDataReady && xpData.level !== undefined) {
      if (prevLevelRef.current === null) {
        prevLevelRef.current = xpData.level
      } else if (xpData.level > prevLevelRef.current) {
        setActiveToast({ key: 'LEVEL UP', message: `Reached Level ${xpData.level}! Keep up the focus!`, id: Date.now() })
        prevLevelRef.current = xpData.level
      }
    }
  }, [xpData.level, isDataReady])

  useEffect(() => {
    if (isDataReady && autoArchiveAncientTasks) {
      const archiveAncientTasks = async () => {
        const ninetyDaysAgo = Date.now() - 7776000000
        const allTasks = await db.tasks.toArray()
        const targetTasks = allTasks.filter(t => t.completed && t.createdAt < ninetyDaysAgo && !t.archived)
        if (targetTasks.length > 0) {
          const ids = targetTasks.map(t => t.id).filter((id): id is number => id !== undefined)
          if (ids.length > 0) {
            await Promise.all(ids.map(id => db.tasks.update(id, { archived: true })))
            pushToast('ARCHIVE', `AUTO-ARCHIVED ${ids.length} COMPLETED TASKS (90+ DAYS)`)
          }
        }
      }
      void archiveAncientTasks()
    }
  }, [isDataReady, autoArchiveAncientTasks])

  useEffect(() => {
    function handleDexieError(e: Event) {
      const error = (e as CustomEvent).detail as { name?: string; message?: string }
      const name = error?.name || 'IndexedDBError'
      const message = error?.message || 'Database transaction failed'
      if (name === 'QuotaExceededError' || message.toLowerCase().includes('quota') || message.toLowerCase().includes('exhausted')) {
        pushToast('DATABASE', 'STORAGE QUOTA EXHAUSTED - TIDY UP NOTES')
      } else {
        pushToast('DATABASE', `DB ERROR: ${name.toUpperCase()}`)
      }
    }
    window.addEventListener('dexie-error', handleDexieError)
    return () => window.removeEventListener('dexie-error', handleDexieError)
  }, [])

  function handleAddTask(text: string, categoryId?: number, estimatedCycles?: number, priority?: 'low' | 'medium' | 'high', isStudySubject?: boolean) {
    const trimmed = text.trim()
    if (!trimmed) return
    addTask(trimmed, categoryId, estimatedCycles ?? taskCycleCount, priority, isStudySubject)
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

  function handleNotesChange(value: string) {
    notesRef.current = value
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      updateDailyReflection(calendar.selectedDateStr, notesRef.current, moodRef.current)
    }, 500)
  }

  function handleMoodSelect(mood: string) {
    const newMood = mood === moodRef.current ? '' : mood
    moodRef.current = newMood
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    updateDailyReflection(calendar.selectedDateStr, notesRef.current, newMood)
  }

  function goPrevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
    else setCurrentMonth(m => m - 1)
  }

  function goNextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
    else setCurrentMonth(m => m + 1)
  }

  function confirmImport(fileString: string) {
    const warn = timer.isTimerActive || timer.showReflectionModal
    if (warn && !confirm('Importing will replace all data and reload the page. An active timer or reflection is in progress. Continue?')) {
      return
    }
    if (!warn && !confirm('Importing will replace all workspace data. Continue?')) {
      return
    }
    void backup.importStudyBackup(fileString)
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      const r = new FileReader()
      r.onload = () => {
        if (typeof r.result === 'string') confirmImport(r.result)
      }
      r.readAsText(file)
    }
  }

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

  const activeThemeVars = THEME_PROFILES[theme] || THEME_PROFILES['midnight-oled']
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
  } as React.CSSProperties

  return (
    <div className="min-h-screen bg-transparent font-sans text-text-primary antialiased relative flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0" style={inlineStyles}>
      <Sidebar
        isZenMode={isZenMode}
        currentStreak={currentStreak}
        level={xpData.level}
        xpProgressPercent={xpData.xpProgressPercent}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setIsHotkeyHudOpen={setIsHotkeyHudOpen}
        isTimerActive={timer.isTimerActive}
        timerMode={timer.timerMode}
        enforceLockout={enforce_lockout}
        onToggleNotes={() => setIsNotesOpen(!isNotesOpen)}
      />

      <main className="flex-1 flex flex-col min-w-0 z-10">
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
                aria-label="Keyboard shortcuts"
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
              >
                <Keyboard className="h-4 w-4" />
              </button>
            </div>
          </header>
        )}

        <div className={`flex-1 p-4 md:p-6 lg:p-8 flex flex-col transition-all duration-700 ${isZenMode ? 'opacity-0 scale-95 pointer-events-none' : ''}`}>
          {!isZenMode && (
            <div className="flex-1 flex flex-col min-h-0">
              {activeTab === 'focus' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start">
                  <div className="lg:col-span-5">
                    <FocusSanctuary
                      timerMode={timer.timerMode}
                      isTimerActive={timer.isTimerActive}
                      setIsTimerActive={timer.setIsTimerActive}
                      remainingSeconds={timer.remainingSeconds}
                      secondsElapsed={timer.secondsElapsed}
                      progress={progress}
                      isLongBreak={timer.isLongBreak}
                      completedSessionsInCycle={timer.completedSessionsInCycle}
                      targetSessionsPerCycle={targetSessionsPerCycle}
                      handleModeSwitch={timer.handleModeSwitch}
                      completeSession={timer.completeSession}
                      extendSession={timer.extendSession}
                      skipBreak={timer.skipBreak}
                      breathTime={breathTime}
                      setIsZenMode={setIsZenMode}
                      onUserGesture={ensureAudio}
                    />
                  </div>
                  <div className="lg:col-span-7">
                    <TaskRegistry
                      tasks={sessionTasks}
                      categories={categories}
                      activeTaskId={activeTaskId}
                      setActiveTaskId={setActiveTaskId}
                      toggleTask={handleToggleTask}
                      handleAddTask={handleAddTask}
                      submitRecallGrade={timer.submitRecallGrade}
                      timerCategoryId={timer.timerCategoryId}
                      setTimerCategoryId={timer.setTimerCategoryId}
                      timerMode={timer.timerMode}
                      taskCycleCount={taskCycleCount}
                      setTaskCycleCount={setTaskCycleCount}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <Suspense fallback={<div className="text-white/50 text-sm p-8">Loading analytics...</div>}>
                  <AnalyticsStudio
                    tasks={sessionTasks}
                    monthLogs={calendar.monthLogs}
                    allLogs={allLogs}
                    totalMonthHours={calendar.totalMonthHours}
                    totalWeeklyBreakHours={calendar.totalWeeklyBreakHours}
                    totalDaysInMonth={calendar.totalDaysInMonth}
                    currentStreak={currentStreak}
                    level={xpData.level}
                    chartData={calendar.chartData}
                    categoryBreakdown={breakdownData.breakdown}
                    topSubject={insights.topSubject}
                    avgMin={insights.avgMin}
                    completionRate={insights.completionRate}
                    peakDay={insights.peakDay}
                    activeThemeVars={activeThemeVars}
                    tooltipStyle={TOOLTIP_STYLE}
                    hasChartData={calendar.hasChartData}
                  />
                </Suspense>
              )}

              {activeTab === 'journal' && (
                <ActivityLedger
                  key={calendar.selectedDateStr}
                  selectedDay={selectedDay}
                  setSelectedDay={setSelectedDay}
                  currentMonth={currentMonth}
                  currentYear={currentYear}
                  monthNames={calendar.monthNames}
                  dayNames={calendar.dayNames}
                  goPrevMonth={goPrevMonth}
                  goNextMonth={goNextMonth}
                  calendarCategoryFilter={calendarCategoryFilter}
                  setCalendarCategoryFilter={setCalendarCategoryFilter}
                  categories={categories}
                  activeThemeVars={activeThemeVars}
                  dynamicGridCells={calendar.dynamicGridCells}
                  activeMonthData={calendar.activeMonthData}
                  isLiveMonth={calendar.isLiveMonth}
                  totalDaysInMonth={calendar.totalDaysInMonth}
                  todayStudyMinutes={todayStudyMinutes}
                  todayBreakMinutes={todayBreakMinutes}
                  progressPercent={calendar.progressPercent}
                  liveDay={calendar.liveDay}
                  initialDraftMood={calendar.selectedDayLog?.mood ?? ''}
                  handleMoodSelect={handleMoodSelect}
                  initialDraftNotes={calendar.selectedDayLog?.notes ?? ''}
                  handleNotesChange={handleNotesChange}
                  selectedDayHistory={calendar.selectedDayHistory}
                  formatMinutes={formatMinutes}
                  getIntensity={getIntensity}
                  hexToRgb={hexToRgb}
                />
              )}

              {activeTab === 'cards' && (
                <FlashcardStudio
                  categories={categories}
                  addCategory={addCategory}
                  deleteCategory={deleteCategory}
                  flashcards={flashcards}
                  addFlashcard={addFlashcard}
                  deleteFlashcard={deleteFlashcard}
                  submitFlashcardGrade={submitFlashcardGrade}
                />
              )}

              {activeTab === 'settings' && (
                <ControlDeck
                  updateSetting={updateSetting}
                  theme={theme}
                  cardOpacity={cardOpacity}
                  backdropBlur={backdropBlur}
                  initialEasinessFactor={initialEasinessFactor}
                  dailyGoalMinutes={dailyGoalMinutes}
                  studyBlockDurationMinutes={studyBlockDurationMinutes}
                  shortBreakDurationMinutes={shortBreakDurationMinutes}
                  longBreakDurationMinutes={longBreakDurationMinutes}
                  targetSessionsPerCycle={targetSessionsPerCycle}
                  soundEnabled={soundEnabled}
                  tactileEnabled={tactile_feedback}
                  developerFont={developer_font}
                  enforceLockout={enforce_lockout}
                  autoArchiveAncientTasks={autoArchiveAncientTasks}
                  exportStudyBackup={backup.exportStudyBackup}
                  exportStudyLogsCSV={backup.exportStudyLogsCSV}
                  exportTaskCompletionLogsCSV={backup.exportTaskCompletionLogsCSV}
                  importStudyBackup={confirmImport}
                  resetData={backup.resetData}
                  resetDataSelective={backup.resetDataSelective}
                  categories={categories}
                  addCategory={addCategory}
                  deleteCategory={deleteCategory}
                  newCategoryName={newCategoryName}
                  setNewCategoryName={setNewCategoryName}
                  newCategoryColor={newCategoryColor}
                  setNewCategoryColor={setNewCategoryColor}
                  isDragging={isDragging}
                  setIsDragging={setIsDragging}
                  handleFileDrop={handleFileDrop}
                  fileInputRef={backup.fileInputRef}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <ZenOverlay
        isZenMode={isZenMode}
        canvasRef={canvasRef}
        remainingSeconds={timer.remainingSeconds}
        timerMode={timer.timerMode}
        sessionTasks={sessionTasks}
        activeTaskId={activeTaskId}
        isTimerActive={timer.isTimerActive}
        setIsTimerActive={timer.setIsTimerActive}
        completeSession={timer.completeSession}
        enforceLockout={enforce_lockout}
        setIsZenMode={setIsZenMode}
      />

      <ReflectionModal
        key={timer.pendingSessionData?.timestamp ?? 'reflection'}
        showReflectionModal={timer.showReflectionModal}
        pendingSessionData={timer.pendingSessionData}
        studyBlockDurationMinutes={studyBlockDurationMinutes}
        attentionRating={timer.attentionRating}
        setAttentionRating={timer.setAttentionRating}
        stabilityRating={timer.stabilityRating}
        setStabilityRating={timer.setStabilityRating}
        localSessionNotes={timer.localSessionNotes}
        setLocalSessionNotes={timer.setLocalSessionNotes}
        onSubmitReflection={timer.submitReflection}
      />

      <HotkeyModal isOpen={isHotkeyHudOpen} onClose={() => setIsHotkeyHudOpen(false)} />

      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-[11px] font-mono tracking-wider text-white animate-slide-down"
        >
          <kbd className="bg-white/10 text-white border border-white/15 rounded px-1.5 py-0.5 text-[9px] font-sans">{activeToast.key}</kbd>
          <span>{activeToast.message}</span>
        </div>
      )}

      <QuickNotesDrawer
        isOpen={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
        categories={categories}
        addCategory={addCategory}
        deleteCategory={deleteCategory}
        notes={quickNotes}
        addNote={addQuickNote}
        updateNote={updateQuickNote}
        deleteNote={deleteQuickNote}
      />

      {!isZenMode && (
        <MobileTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isTimerActive={timer.isTimerActive}
          timerMode={timer.timerMode}
          enforceLockout={enforce_lockout}
        />
      )}
    </div>
  )
}

export default App
