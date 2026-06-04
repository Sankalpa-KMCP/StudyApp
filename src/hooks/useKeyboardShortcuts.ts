import { useEffect } from 'react'
import type { ActiveTab, ToastState } from '../types/app'

interface UseKeyboardShortcutsOptions {
  activeTab: ActiveTab
  isHotkeyHudOpen: boolean
  isTimerActive: boolean
  timerMode: 'study' | 'break'
  enforceLockout: boolean
  completingRef: React.RefObject<boolean>
  handleModeSwitch: (mode: 'study' | 'break') => void
  completeSession: () => void
  setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
  setIsZenMode: React.Dispatch<React.SetStateAction<boolean>>
  setIsHotkeyHudOpen: React.Dispatch<React.SetStateAction<boolean>>
  setActiveToast: React.Dispatch<React.SetStateAction<ToastState | null>>
}

export function useKeyboardShortcuts({
  activeTab,
  isHotkeyHudOpen,
  isTimerActive,
  timerMode,
  enforceLockout,
  completingRef,
  handleModeSwitch,
  completeSession,
  setIsTimerActive,
  setIsZenMode,
  setIsHotkeyHudOpen,
  setActiveToast,
}: UseKeyboardShortcutsOptions) {
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
              id: Date.now(),
            })
            return nextActive
          })
          break
        case 's':
          handleModeSwitch('study')
          setActiveToast({ key: 'S', message: 'SWITCHED TO DEEP WORK', id: Date.now() })
          break
        case 'b':
          handleModeSwitch('break')
          setActiveToast({ key: 'B', message: 'SWITCHED TO BREAK MODE', id: Date.now() })
          break
        case 'c':
          void completeSession()
          setActiveToast({ key: 'C', message: 'FOCUS BLOCK COMPLETED', id: Date.now() })
          break
        case 'z':
          if (enforceLockout && isTimerActive && timerMode === 'study') {
            setActiveToast({ key: 'LOCK', message: 'LOCKOUT ACTIVE - COMPULSORY STUDY', id: Date.now() })
            break
          }
          setIsZenMode(zen => {
            const nextZen = !zen
            setActiveToast({
              key: 'Z',
              message: nextZen ? 'ENTERED ZEN SANCTUARY' : 'EXITED ZEN SANCTUARY',
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
              message: nextOpen ? 'OPENED SHORTCUT PANEL' : 'CLOSED SHORTCUT PANEL',
              id: Date.now(),
            })
            return nextOpen
          })
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
    completingRef,
    handleModeSwitch,
    completeSession,
    setIsTimerActive,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setActiveToast,
  ])
}
