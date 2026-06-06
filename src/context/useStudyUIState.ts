import { useState, useEffect, useRef, useMemo } from 'react'
import type { ActiveTab } from '../types/app'
import { THEME_PROFILES } from '../lib/theme'
import { useZenCanvas } from '../hooks/useZenCanvas'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useStudyDataContext } from './studyDataContext'
import { useStudyTimerContext } from './studyTimerContext'
import type { useAppToast } from '../hooks/useAppToast'

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIState(toast: ToastApi) {
  const { settings } = useStudyDataContext()
  const { timer } = useStudyTimerContext()
  const { activeToast, setActiveToast } = toast

  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [breathTime, setBreathTime] = useState(0)
  const [isZenMode, setIsZenMode] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('focus')
  const [isDragging, setIsDragging] = useState(false)
  const [isHotkeyHudOpen, setIsHotkeyHudOpen] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useZenCanvas(isZenMode, canvasRef)

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
  })

  useEffect(() => {
    const interval = setInterval(() => setBreathTime(t => (t + 1) % 12), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-monospace', `'${settings.developer_font}', monospace`)
  }, [settings.developer_font])

  const activeThemeVars = useMemo(
    () => THEME_PROFILES[settings.theme] || THEME_PROFILES['midnight-oled'],
    [settings.theme],
  )

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
  }), [
    activeToast,
    isNotesOpen,
    breathTime,
    isZenMode,
    activeTab,
    isDragging,
    isHotkeyHudOpen,
    activeThemeVars,
    handleFileDrop,
  ])
}
