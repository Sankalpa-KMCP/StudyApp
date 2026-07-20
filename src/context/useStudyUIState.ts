import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { readAppHashFromLocation } from '../lib/routing/appHashRouting'
import { KEYBOARD_TAB_ORDER } from '../navigation/appNav'
import { useZenCanvas } from '../hooks/useZenCanvas'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFocusLockoutNavigation } from '../hooks/useFocusLockoutNavigation'
import { useOptionalSidebarCollapse } from './sidebar/sidebarCollapseContext'
import { useStudyCore } from './studyDataSlices'
import { useStudyTimerContext } from './studyTimerContext'
import { useConfirm } from './useConfirm'
import type { useAppToast } from '../hooks/useAppToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { setAppLocale, t } from '../i18n'
import { setDeferredDataFlags } from '../hooks/useDeferredDataEnabled'
import { useDatabaseRecovery } from '../hooks/useDatabaseRecovery'

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIState(toast: ToastApi) {
  const { settings } = useStudyCore()
  const { timerControls } = useStudyTimerContext()
  const { requestConfirm } = useConfirm()
  const { activeToast, setActiveToast, quotaExceeded, dismissQuotaRecovery } = toast
  const { scheduleDelete } = useUndoDelete({ setActiveToast })
  const databaseRecovery = useDatabaseRecovery()

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => readAppHashFromLocation().tab)
  const [isDragging, setIsDragging] = useState(false)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [focusNoteId, setFocusNoteId] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useZenCanvas(isZenMode, canvasRef)

  const sidebarCollapse = useOptionalSidebarCollapse()

  const notifyFocusLockout = useCallback(() => {
    setActiveToast({
      key: 'LOCK',
      message: t('pauseTimerToLeave'),
      id: Date.now(),
    })
  }, [setActiveToast])

  const navigateToTab = useFocusLockoutNavigation({
    enforceLockout: settings.enforce_lockout,
    lockoutMode: settings.lockoutMode,
    lockoutAllowedTabs: settings.lockoutAllowedTabs,
    lockoutStudyOnly: settings.lockoutStudyOnly,
    activeTab,
    timer: timerControls,
    setActiveTab: setActiveTabState,
    onLockedAttempt: notifyFocusLockout,
  })

  useKeyboardShortcuts({
    activeTab,
    isHotkeyHudOpen,
    isTimerActive: timerControls.isTimerActive,
    timerMode: timerControls.timerMode,
    enforceLockout: settings.enforce_lockout,
    showReflectionModal: timerControls.showReflectionModal,
    secondsElapsedRef: timerControls.secondsElapsedRef,
    completingRef: timerControls.completingRef,
    handleModeSwitch: timerControls.handleModeSwitch,
    completeSession: timerControls.completeSession,
    setIsTimerActive: timerControls.setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveToast,
    navigateToTab,
    toggleSidebarCollapse: sidebarCollapse?.toggleCollapsed,
    requestConfirm,
    visibleTabs: KEYBOARD_TAB_ORDER,
  })

  useEffect(() => {
    setDeferredDataFlags({
      notesEnabled: isNotesOpen || isCommandPaletteOpen,
      fullLogsEnabled: isCommandPaletteOpen,
    })
  }, [isNotesOpen, isCommandPaletteOpen])

  useEffect(() => {
    setAppLocale(settings.locale)
  }, [settings.locale])

  const handleFileDrop = useCallback((e: React.DragEvent, confirmImport: (s: string) => void) => {
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
  }, [])

  return useMemo(() => ({
    pushToast: toast.pushToast,
    activeToast,
    quotaExceeded,
    dismissQuotaRecovery,
    isNotesOpen,
    setIsNotesOpen,
    isZenMode,
    setIsZenMode,
    activeTab,
    setActiveTab: navigateToTab,
    isDragging,
    setIsDragging,
    isHotkeyHudOpen,
    setIsHotkeyHudOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    focusNoteId,
    setFocusNoteId,
    canvasRef,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
    databaseRecovery,
  }), [
    toast.pushToast,
    activeToast,
    quotaExceeded,
    dismissQuotaRecovery,
    isNotesOpen,
    isZenMode,
    activeTab,
    navigateToTab,
    isDragging,
    isHotkeyHudOpen,
    isCommandPaletteOpen,
    focusNoteId,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
    databaseRecovery,
  ])
}
