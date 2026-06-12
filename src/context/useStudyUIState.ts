import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { applyThemeToDocument } from '../lib/theme/applyThemeVars'
import { readAppHashFromLocation, writeAppHash, resolveAppHash } from '../lib/routing/appHashRouting'
import { getKeyboardTabOrder } from '../navigation/appNav'
import { setActiveTabSync } from '../lib/routing/activeTabSync'
import { loadAppFonts } from '../lib/theme/loadAppFonts'
import { resolveThemeProfile } from '../lib/theme/theme'
import { useZenCanvas } from '../hooks/useZenCanvas'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useFocusLockoutNavigation } from '../hooks/useFocusLockoutNavigation'
import { useOptionalSidebarCollapse } from '../components/sidebar/useSidebarCollapseContext'
import { useStudyDataContext } from './studyDataContext'
import { useStudyTimerContext, useStudyTimerDisplay } from './studyTimerContext'
import { useConfirm } from './useConfirm'
import type { useAppToast } from '../hooks/useAppToast'
import { useUndoDelete } from '../hooks/useUndoDelete'
import { PAUSE_TIMER_TO_LEAVE } from '../lib/shared/uxTerms'
import { setAppLocale } from '../i18n'

const UI_FONT_STACKS: Record<string, string> = {
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Outfit: "'Outfit', 'Inter', sans-serif",
  System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIState(toast: ToastApi) {
  const { settings } = useStudyDataContext()
  const { timerControls } = useStudyTimerContext()
  const timerDisplay = useStudyTimerDisplay()
  const { requestConfirm } = useConfirm()
  const { activeToast, setActiveToast, quotaExceeded, dismissQuotaRecovery } = toast
  const { scheduleDelete } = useUndoDelete({ setActiveToast })

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTabState] = useState<ActiveTab>(() => readAppHashFromLocation().tab)
  const activeTabRef = useRef(activeTab)
  const [isDragging, setIsDragging] = useState(false)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [focusNoteId, setFocusNoteId] = useState<number | null>(null)
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useZenCanvas(isZenMode, canvasRef)

  const sidebarCollapse = useOptionalSidebarCollapse()

  const notifyFocusLockout = useCallback(() => {
    setActiveToast({
      key: 'LOCK',
      message: PAUSE_TIMER_TO_LEAVE,
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
    secondsElapsed: timerDisplay.secondsElapsed,
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
    visibleTabs: getKeyboardTabOrder(settings.flashcardsEnabled),
  })

  useEffect(() => {
    if (!settings.flashcardsEnabled && activeTab === 'cards') {
      navigateToTab('focus')
    }
  }, [settings.flashcardsEnabled, activeTab, navigateToTab])

  useEffect(() => {
    setAppLocale(settings.locale)
  }, [settings.locale])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${settings.developer_font}', monospace`)
  }, [settings.developer_font])

  useEffect(() => {
    const stack = UI_FONT_STACKS[settings.ui_font] ?? UI_FONT_STACKS.Inter
    document.documentElement.style.setProperty('--font-sans-geom', stack)
  }, [settings.ui_font])

  useEffect(() => {
    void loadAppFonts(settings.ui_font, settings.developer_font)
  }, [settings.ui_font, settings.developer_font])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    setActiveTabSync(activeTab)
    writeAppHash(activeTab)
  }, [activeTab])

  useEffect(() => {
    const onHashChange = () => {
      const { tab } = readAppHashFromLocation()
      const resolved = resolveAppHash(tab, settings.flashcardsEnabled)
      if (resolved !== tab) {
        writeAppHash(resolved)
      }
      if (resolved === activeTabRef.current) return
      void navigateToTab(resolved).then(() => {
        if (activeTabRef.current !== resolved) {
          writeAppHash(activeTabRef.current)
        }
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [settings.flashcardsEnabled, navigateToTab])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const activeThemeVars = useMemo(
    () =>
      resolveThemeProfile(settings.theme, settings.themePreset, prefersDark, settings.lightThemePreset, {
        accentBlueOverride: settings.accentBlueOverride,
        accentPurpleOverride: settings.accentPurpleOverride,
        accentGreenOverride: settings.accentGreenOverride,
        accentAmberOverride: settings.accentAmberOverride,
      }),
    [
      settings.theme,
      settings.themePreset,
      settings.lightThemePreset,
      settings.accentBlueOverride,
      settings.accentPurpleOverride,
      settings.accentGreenOverride,
      settings.accentAmberOverride,
      prefersDark,
    ],
  )

  useEffect(() => {
    applyThemeToDocument(activeThemeVars, {
      cardOpacity: settings.cardOpacity,
      backdropBlur: settings.backdropBlur,
      backdropSaturate: settings.backdropSaturate,
      cardBorderOpacity: settings.cardBorderOpacity,
    })
  }, [
    activeThemeVars,
    settings.cardOpacity,
    settings.backdropBlur,
    settings.backdropSaturate,
    settings.cardBorderOpacity,
  ])

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
    activeThemeVars,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
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
    activeThemeVars,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
  ])
}
