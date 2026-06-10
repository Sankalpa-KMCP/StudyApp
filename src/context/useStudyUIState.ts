import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { ActiveTab } from '../types/app'
import { resolveThemeProfile } from '../lib/theme'
import { useZenCanvas } from '../hooks/useZenCanvas'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useOptionalSidebarCollapse } from '../components/sidebar/useSidebarCollapseContext'
import { useStudyDataContext } from './studyDataContext'
import { useStudyTimerContext } from './studyTimerContext'
import type { useAppToast } from '../hooks/useAppToast'
import { useUndoDelete } from '../hooks/useUndoDelete'

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIState(toast: ToastApi) {
  const { settings } = useStudyDataContext()
  const { timer } = useStudyTimerContext()
  const { activeToast, setActiveToast, quotaExceeded, dismissQuotaRecovery } = toast
  const { scheduleDelete } = useUndoDelete({ setActiveToast })

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [breathTime, setBreathTime] = useState(0)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('focus')
  const [isDragging, setIsDragging] = useState(false)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)
  const [prefersDark, setPrefersDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useZenCanvas(isZenMode, canvasRef)

  const sidebarCollapse = useOptionalSidebarCollapse()

  useKeyboardShortcuts({
    activeTab,
    isHotkeyHudOpen,
    isTimerActive: timer.isTimerActive,
    timerMode: timer.timerMode,
    enforceLockout: settings.enforce_lockout,
    completingRef: timer.completingRef,
    handleModeSwitch: timer.handleModeSwitch,
    completeSession: timer.completeSession,
    setIsTimerActive: timer.setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setActiveToast,
    toggleSidebarCollapse: sidebarCollapse?.toggleCollapsed,
  })

  useEffect(() => {
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1250)
    return () => clearInterval(interval)
  }, [])

  const UI_FONT_STACKS: Record<string, string> = {
    Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    Outfit: "'Outfit', 'Inter', sans-serif",
    System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${settings.developer_font}', monospace`)
  }, [settings.developer_font])

  useEffect(() => {
    const stack = UI_FONT_STACKS[settings.ui_font] ?? UI_FONT_STACKS.Inter
    document.documentElement.style.setProperty('--font-sans-geom', stack)
  }, [settings.ui_font])

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

  const notifyFocusLockout = useCallback(() => {
    setActiveToast({
      key: 'LOCK',
      message: 'Focus lockout — complete your session first',
      id: Date.now(),
    })
  }, [setActiveToast])

  const handleFileDrop = (e: React.DragEvent, confirmImport: (s: string) => void) => {
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

  return useMemo(() => ({
    activeToast,
    quotaExceeded,
    dismissQuotaRecovery,
    isNotesOpen,
    setIsNotesOpen,
    breathTime,
    isZenMode,
    setIsZenMode,
    activeTab,
    setActiveTab,
    isDragging,
    setIsDragging,
    isHotkeyHudOpen,
    setIsHotkeyHudOpen,
    canvasRef,
    activeThemeVars,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
  }), [
    activeToast,
    quotaExceeded,
    dismissQuotaRecovery,
    isNotesOpen,
    breathTime,
    isZenMode,
    activeTab,
    isDragging,
    isHotkeyHudOpen,
    activeThemeVars,
    handleFileDrop,
    notifyFocusLockout,
    scheduleDelete,
  ])
}
