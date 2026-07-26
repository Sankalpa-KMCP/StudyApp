import { useCallback, useEffect, useState } from 'react'
import { useFocusSession } from './hooks/useFocusSession'
import { useSidebarPreference } from './hooks/useSidebarPreference'
import { useStudyBackup } from './hooks/useStudyBackup'
import { useThemePreference } from './hooks/useThemePreference'
import { migrateLegacyLocalStorage } from './db/studyDb'
import type { ActiveFocusSession, StudySubject } from './db/types'
import { Sidebar } from './components/Sidebar'
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
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'done'>('all')
  const [taskEditorRequest, setTaskEditorRequest] = useState(0)
  const [subjectEditorRequest, setSubjectEditorRequest] = useState(0)
  const [progressEditorRequested, setProgressEditorRequested] = useState(false)
  const [profileNotice, setProfileNotice] = useState('')
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null)
  const [subjectMap, setSubjectMap] = useState(() => new Map<string, StudySubject>())
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

  const syncUrlToView = useCallback((view: View, historyMode: 'push' | 'replace') => {
    const nextPath = pathForView(view)
    if (pathnamesMatch(window.location.pathname, nextPath)) return
    if (historyMode === 'replace') {
      window.history.replaceState(null, '', nextPath)
      return
    }
    window.history.pushState(null, '', nextPath)
  }, [])

  const navigateToView = useCallback((view: View) => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setActiveView(view)
    syncUrlToView(view, 'push')
  }, [syncUrlToView])

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
      setProgressEditorRequested(false)
      setTaskEditorRequest(0)
      setSubjectEditorRequest(0)
      setActiveView(resolved.view)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [syncUrlToView])

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
    runWithFocusImportLock,
    clearFocusLocalState,
  } = useFocusSession({ subjectMap })

  const onBackupClearSuccess = useCallback(() => {
    setProfileNotice('All study data has been permanently deleted.')
    navigateToView('Home')
    setTimeout(() => setProfileNotice(''), 5000)
  }, [navigateToView])
  const { exportBackup, importBackup, clearAllBackup } = useStudyBackup({
    runWithFocusImportLock,
    reloadFocusFromIndexedDb,
    clearFocusLocalState,
    onClearSuccess: onBackupClearSuccess,
  })

  useEffect(() => {
    const behavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.scrollingElement?.scrollTo?.({ behavior, top: 0 })
  }, [activeView])

  const openNewTask = () => {
    setProgressEditorRequested(false)
    setSubjectEditorRequest(0)
    setActiveView('Tasks')
    syncUrlToView('Tasks', 'push')
    setTaskEditorRequest((request) => request + 1)
  }

  const openNewSubject = () => {
    setProgressEditorRequested(false)
    setTaskEditorRequest(0)
    setActiveView('Subjects')
    syncUrlToView('Subjects', 'push')
    setSubjectEditorRequest((request) => request + 1)
  }

  const openManualSession = () => {
    setTaskEditorRequest(0)
    setSubjectEditorRequest(0)
    setProgressEditorRequested(true)
    setActiveView('Progress')
    syncUrlToView('Progress', 'push')
  }

  const closeNotices = useCallback(() => setNoticeOpen(false), [])
  const toggleNotices = useCallback(() => setNoticeOpen((open) => !open), [])
  const onSubjectMapChange = useCallback((next: Map<string, StudySubject>) => {
    setSubjectMap(next)
  }, [])

  return (
    <div className={sidebarCollapsed ? 'app-shell is-sidebar-collapsed' : 'app-shell'}>
      <a className="skip-link" href="#dashboard-main">Skip to dashboard</a>
      <Sidebar
        activeView={activeView}
        collapsed={sidebarCollapsed}
        onNavigate={navigateToView}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <div className="workspace">
        <AppLiveData
          activeView={activeView}
          taskFilter={taskFilter}
          onTaskFilterChange={setTaskFilter}
          taskEditorRequest={taskEditorRequest}
          subjectEditorRequest={subjectEditorRequest}
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
          onCreateTask={openNewTask}
          onCreateSubject={openNewSubject}
          onLogSession={openManualSession}
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
        />
      </div>
    </div>
  )
}

export default App
