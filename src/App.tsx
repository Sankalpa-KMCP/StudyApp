import { useCallback, useEffect, useState } from 'react'
import { useDataCoordinator } from './hooks/useDataCoordinator'
import { useFocusSession } from './hooks/useFocusSession'
import { useMobileNavBreakpoint } from './hooks/useMobileNavBreakpoint'
import { useSidebarPreference } from './hooks/useSidebarPreference'
import { useStudyBackup } from './hooks/useStudyBackup'
import { useThemePreference } from './hooks/useThemePreference'
import {
  dismissOnboardingChecklist,
  showOnboardingChecklist,
} from './db/onboardingChecklistPreference'
import { migrateLegacyLocalStorage } from './db/studyDb'
import type { ActiveFocusSession, StudySubject } from './db/types'
import { Sidebar } from './components/Sidebar'
import { MobileNavigation } from './components/MobileNavigation'
import { AppLiveReadFallback } from './components/AppLiveReadFallback'
import { LiveReadErrorBoundary } from './components/LiveReadErrorBoundary'
import { AppLiveData } from './AppLiveData'
import {
  pathForView,
  pathnamesMatch,
  resolveViewFromPathname,
  type View,
} from './navigation/viewRoutes'

export type { View }
export type SettingsFeedback = { tone: 'success' | 'error'; message: string }
/** @deprecated Use ActiveFocusSession — kept as alias for existing imports. */
export type ActiveSession = ActiveFocusSession
/** Re-exported for existing consumers; prefer `./hooks/useThemePreference`. */
export type { ThemeMode } from './hooks/useThemePreference'

function App() {
  const [activeView, setActiveView] = useState<View>(() => resolveViewFromPathname(window.location.pathname).view)
  const { coordinator } = useDataCoordinator()
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all')
  const [taskEditorRequest, setTaskEditorRequest] = useState(0)
  const [subjectEditorRequest, setSubjectEditorRequest] = useState(0)
  const [noteEditorRequest, setNoteEditorRequest] = useState(0)
  const [eventEditorRequest, setEventEditorRequest] = useState(0)
  const [flashcardEditorRequest, setFlashcardEditorRequest] = useState(0)
  const [focusAttentionRequest, setFocusAttentionRequest] = useState(0)
  const [progressEditorRequested, setProgressEditorRequested] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null)
  const [subjectMap, setSubjectMap] = useState(() => new Map<string, StudySubject>())
  const [liveReadEpoch, setLiveReadEpoch] = useState(0)
  const clearPreferenceNotice = useCallback(() => setPreferenceNotice(null), [])
  const reportPreferenceError = useCallback((message: string) => setPreferenceNotice(message), [])
  const { theme, setTheme } = useThemePreference({
    onPreferenceError: reportPreferenceError,
    clearPreferenceNotice,
  })
  const { sidebarCollapsed, toggleSidebarCollapsed } = useSidebarPreference({
    onPreferenceError: reportPreferenceError,
    clearPreferenceNotice,
  })
  const isMobileNav = useMobileNavBreakpoint()

  const syncUrlToView = useCallback((view: View, historyMode: 'push' | 'replace') => {
    const nextPath = pathForView(view)
    if (pathnamesMatch(window.location.pathname, nextPath)) return
    if (historyMode === 'replace') {
      window.history.replaceState(null, '', nextPath)
      return
    }
    window.history.pushState(null, '', nextPath)
  }, [])

  const clearEditorRequests = useCallback(() => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setNoteEditorRequest(0)
    setEventEditorRequest(0)
    setFlashcardEditorRequest(0)
    setFocusAttentionRequest(0)
  }, [])

  const navigateToView = useCallback((view: View) => {
    clearEditorRequests()
    setActiveView(view)
    syncUrlToView(view, 'push')
  }, [clearEditorRequests, syncUrlToView])

  useEffect(() => {
    void migrateLegacyLocalStorage()
  }, [])

  useEffect(() => {
    const resolved = resolveViewFromPathname(window.location.pathname)
    if (resolved.needsReplace) {
      syncUrlToView(resolved.view, 'replace')
    }
  }, [syncUrlToView])

  useEffect(() => {
    const onPopState = () => {
      const resolved = resolveViewFromPathname(window.location.pathname)
      if (resolved.needsReplace) {
        syncUrlToView(resolved.view, 'replace')
      }
      clearEditorRequests()
      setActiveView(resolved.view)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [clearEditorRequests, syncUrlToView])

  const {
    activeSession,
    staleFocusSession,
    staleFocusSubjectName,
    sessionLimitSeconds,
    sessionNotice,
    canStartFocus,
    focusActionsPending,
    focusImportPending,
    focusSubjectId,
    focusDurationMinutes,
    setFocusDurationMinutes,
    updateFocusSubject,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    acceptStaleFocusSession,
    discardStaleFocusSession,
    reloadFocusFromIndexedDb,
    clearFocusLocalState,
  } = useFocusSession({ subjectMap })

  const onBackupClearSuccess = useCallback(() => {
    setProfileNotice('All study data has been permanently deleted.')
    navigateToView('Home')
    setTimeout(() => setProfileNotice(''), 5000)
  }, [navigateToView])
  const { exportBackup, importBackup, clearAllBackup } = useStudyBackup({
    coordinator,
    reloadFocusFromIndexedDb,
    clearFocusLocalState,
    onClearSuccess: onBackupClearSuccess,
  })

  useEffect(() => {
    // Focus quick-add owns scroll/focus for Home; do not yank the viewport to the top first.
    if (activeView === 'Home' && focusAttentionRequest > 0) return
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.scrollingElement?.scrollTo?.({ behavior, top: 0 })
  }, [activeView, focusAttentionRequest])

  const openNewTask = () => {
    setProgressEditorRequested(false)
    setSubjectEditorRequest(0)
    setNoteEditorRequest(0)
    setEventEditorRequest(0)
    setFlashcardEditorRequest(0)
    setFocusAttentionRequest(0)
    setActiveView('Tasks')
    syncUrlToView('Tasks', 'push')
    setTaskEditorRequest((request) => request + 1)
  }

  const openNewSubject = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setNoteEditorRequest(0)
    setEventEditorRequest(0)
    setFlashcardEditorRequest(0)
    setFocusAttentionRequest(0)
    setActiveView('Subjects')
    syncUrlToView('Subjects', 'push')
    setSubjectEditorRequest((request) => request + 1)
  }

  const openNewNote = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setEventEditorRequest(0)
    setFlashcardEditorRequest(0)
    setFocusAttentionRequest(0)
    setActiveView('Notes')
    syncUrlToView('Notes', 'push')
    setNoteEditorRequest((request) => request + 1)
  }

  const openNewEvent = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setNoteEditorRequest(0)
    setFlashcardEditorRequest(0)
    setFocusAttentionRequest(0)
    setActiveView('Calendar')
    syncUrlToView('Calendar', 'push')
    setEventEditorRequest((request) => request + 1)
  }

  const openNewFlashcard = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setNoteEditorRequest(0)
    setEventEditorRequest(0)
    setFocusAttentionRequest(0)
    setActiveView('Flashcards')
    syncUrlToView('Flashcards', 'push')
    setFlashcardEditorRequest((request) => request + 1)
  }

  const openFocusAttention = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setNoteEditorRequest(0)
    setEventEditorRequest(0)
    setFlashcardEditorRequest(0)
    setActiveView('Home')
    syncUrlToView('Home', 'push')
    setFocusAttentionRequest((request) => request + 1)
  }

  const onQuickAdd = (item: 'task' | 'note' | 'event' | 'flashcard' | 'focus') => {
    if (item === 'task') openNewTask()
    else if (item === 'note') openNewNote()
    else if (item === 'event') openNewEvent()
    else if (item === 'flashcard') openNewFlashcard()
    else openFocusAttention()
  }

  const closeNotices = useCallback(() => setNoticeOpen(false), [])
  const toggleNotices = useCallback(() => setNoticeOpen((open) => !open), [])
  const onSubjectMapChange = useCallback((next: Map<string, StudySubject>) => {
    setSubjectMap(next)
  }, [])
  const retryLiveReads = useCallback(() => {
    setLiveReadEpoch((epoch) => epoch + 1)
  }, [])

  return (
    <div className={[
      'app-shell',
      sidebarCollapsed ? 'is-sidebar-collapsed' : '',
      isMobileNav ? 'is-mobile-nav' : '',
    ].filter(Boolean).join(' ')}>
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      {isMobileNav ? (
        <MobileNavigation activeView={activeView} onNavigate={navigateToView} />
      ) : (
        <Sidebar
          activeView={activeView}
          collapsed={sidebarCollapsed}
          onNavigate={navigateToView}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      )}
      <div className="workspace">
        <LiveReadErrorBoundary
          key={liveReadEpoch}
          fallback={(
            <AppLiveReadFallback
              activeView={activeView}
              noticeOpen={noticeOpen}
              noticePopoverId="notice-popover"
              onToggleNotices={toggleNotices}
              onCloseNotices={closeNotices}
              onQuickAdd={onQuickAdd}
              onOpenProfile={() => {
                navigateToView('Settings')
                setProfileNotice('Profile settings live in this local Settings workspace for now.')
              }}
              onRetry={retryLiveReads}
              profileNotice={profileNotice}
              preferenceNotice={preferenceNotice}
              onDismissPreferenceNotice={clearPreferenceNotice}
              theme={theme}
              onThemeChange={setTheme}
              onExport={exportBackup}
              onImport={importBackup}
              onClear={clearAllBackup}
              onShowOnboardingChecklist={showOnboardingChecklist}
              importPending={focusImportPending}
            />
          )}
        >
          <AppLiveData
            activeView={activeView}
            taskFilter={taskFilter}
            onTaskFilterChange={setTaskFilter}
            taskEditorRequest={taskEditorRequest}
            subjectEditorRequest={subjectEditorRequest}
            noteEditorRequest={noteEditorRequest}
            eventEditorRequest={eventEditorRequest}
            flashcardEditorRequest={flashcardEditorRequest}
            focusAttentionRequest={focusAttentionRequest}
            progressEditorRequested={progressEditorRequested}
            noticeOpen={noticeOpen}
            noticePopoverId="notice-popover"
            onToggleNotices={toggleNotices}
            onCloseNotices={closeNotices}
            profileNotice={profileNotice}
            preferenceNotice={preferenceNotice}
            onDismissPreferenceNotice={clearPreferenceNotice}
            theme={theme}
            onThemeChange={setTheme}
            onNavigate={navigateToView}
            onOpenProfile={() => {
              navigateToView('Settings')
              setProfileNotice('Profile settings live in this local Settings workspace for now.')
            }}
            onQuickAdd={onQuickAdd}
            onCreateTask={openNewTask}
            onCreateSubject={openNewSubject}
            onRevealFocusSession={openFocusAttention}
            onSubjectMapChange={onSubjectMapChange}
            activeSession={activeSession}
            staleFocusSession={staleFocusSession}
            staleFocusSubjectName={staleFocusSubjectName}
            sessionLimitSeconds={sessionLimitSeconds}
            sessionNotice={sessionNotice}
            canStartFocus={canStartFocus}
            focusActionsPending={focusActionsPending}
            focusImportPending={focusImportPending}
            focusSubjectId={focusSubjectId}
            focusDurationMinutes={focusDurationMinutes}
            onFocusSubjectChange={updateFocusSubject}
            onFocusDurationChange={setFocusDurationMinutes}
            onStartSession={() => void startSession()}
            onPauseSession={() => void pauseSession()}
            onResumeSession={() => void resumeSession()}
            onStopSession={() => stopSession(false)}
            onAcceptStaleFocusSession={() => void acceptStaleFocusSession()}
            onDiscardStaleFocusSession={() => void discardStaleFocusSession()}
            onExport={exportBackup}
            onImport={importBackup}
            onClear={clearAllBackup}
            onDismissOnboardingChecklist={dismissOnboardingChecklist}
            onShowOnboardingChecklist={showOnboardingChecklist}
          />
        </LiveReadErrorBoundary>
      </div>
    </div>
  )
}

export default App
