import { useEffect } from 'react'
import type { ActiveTab, ToastState } from '../types/app'
import { FOCUS_LOCKOUT_ACTIVE } from '../lib/uxTerms'
import { SHORTCUT_TOASTS } from '../lib/shortcutToasts'

type RequestConfirm = (options: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}) => Promise<boolean>

interface UseKeyboardShortcutsOptions {
  activeTab: ActiveTab
  isHotkeyHudOpen: boolean
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  showReflectionModal: boolean
  secondsElapsed: number
  completingRef: React.RefObject<boolean>
  handleModeSwitch: (mode: 'study' | 'break') => void
  completeSession: () => Promise<'reflection' | 'completed' | 'blocked'>
  setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
  setIsZenMode: React.Dispatch<React.SetStateAction<boolean>>
  setIsHotkeyHudOpen: React.Dispatch<React.SetStateAction<boolean>>
  setActiveToast: React.Dispatch<React.SetStateAction<ToastState | null>>
  setActiveTab?: React.Dispatch<React.SetStateAction<ActiveTab>>
  toggleSidebarCollapse?: () => void
  requestConfirm?: RequestConfirm
}

const TIMER_KEYS = new Set([' ', 's', 'b', 'c', 'z'])

export function useKeyboardShortcuts({
  activeTab,
  isHotkeyHudOpen,
  isTimerActive,
  timerMode,
  enforceLockout,
  showReflectionModal,
  secondsElapsed,
  completingRef,
  handleModeSwitch,
  completeSession,
  setIsTimerActive,
  setIsZenMode,
  setIsHotkeyHudOpen,
  setActiveToast,
  setActiveTab,
  toggleSidebarCollapse,
  requestConfirm,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (showReflectionModal) return
      if (completingRef.current) return

      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (isHotkeyHudOpen && e.key !== '?' && e.key !== 'Escape') return

      const settingsBlocksShortcuts = activeTab === 'settings' && !isTimerActive
      const key = e.key.toLowerCase()

      if (settingsBlocksShortcuts && TIMER_KEYS.has(key)) return
      if (activeTab === 'settings' && !isTimerActive && key === '?') return

      if (inInput && TIMER_KEYS.has(key)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      switch (key) {
        case ' ':
          e.preventDefault()
          setIsTimerActive(active => {
            const nextActive = !active
            setActiveToast({
              key: 'SPACE',
              message: nextActive ? SHORTCUT_TOASTS.space.running : SHORTCUT_TOASTS.space.paused,
              id: Date.now(),
            })
            return nextActive
          })
          break
        case 's':
          handleModeSwitch('study')
          setActiveToast({ key: 'S', message: SHORTCUT_TOASTS.study, id: Date.now() })
          break
        case 'b':
          handleModeSwitch('break')
          setActiveToast({ key: 'B', message: SHORTCUT_TOASTS.break, id: Date.now() })
          break
        case 'c':
          void (async () => {
            if (secondsElapsed < 60 && !e.shiftKey) {
              if (!requestConfirm) return
              const ok = await requestConfirm({
                title: 'End study block early?',
                message: 'This session is under a minute. Save it anyway?',
                confirmLabel: 'Save session',
                cancelLabel: 'Keep going',
              })
              if (!ok) return
            }
            const result = await completeSession()
            if (result === 'completed') {
              setActiveToast({ key: 'C', message: SHORTCUT_TOASTS.complete, id: Date.now() })
            }
          })()
          break
        case 'z':
          if (enforceLockout && isTimerActive && timerMode === 'study') {
            setActiveToast({ key: 'LOCK', message: FOCUS_LOCKOUT_ACTIVE, id: Date.now() })
            break
          }
          setIsZenMode(zen => {
            const nextZen = !zen
            setActiveToast({
              key: 'Z',
              message: nextZen ? SHORTCUT_TOASTS.focusMode.on : SHORTCUT_TOASTS.focusMode.off,
              id: Date.now(),
            })
            return nextZen
          })
          break
        case '?':
          setIsHotkeyHudOpen(o => {
            const nextOpen = !o
            setActiveToast({
              key: '?',
              message: nextOpen ? SHORTCUT_TOASTS.shortcutsPanel.open : SHORTCUT_TOASTS.shortcutsPanel.close,
              id: Date.now(),
            })
            return nextOpen
          })
          break
        case '[':
          if (toggleSidebarCollapse && window.matchMedia('(min-width: 768px)').matches) {
            toggleSidebarCollapse()
            setActiveToast({
              key: '[',
              message: SHORTCUT_TOASTS.sidebar,
              id: Date.now(),
            })
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          if (inInput || !setActiveTab) break
          {
            const tabs: ActiveTab[] = ['focus', 'cards', 'analytics', 'journal', 'settings']
            const idx = Number(key) - 1
            if (idx < tabs.length) {
              setActiveTab(tabs[idx])
            }
          }
          break
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    activeTab,
    isHotkeyHudOpen,
    isTimerActive,
    timerMode,
    enforceLockout,
    showReflectionModal,
    secondsElapsed,
    completingRef,
    handleModeSwitch,
    completeSession,
    setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setActiveToast,
    setActiveTab,
    toggleSidebarCollapse,
    requestConfirm,
  ])
}
