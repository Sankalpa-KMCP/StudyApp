import { createContext, useContext } from 'react'
import type { useStudyTimerState } from './useStudyTimerState'
import type { useTimerEngine } from '../hooks/useTimerEngine'

export type TimerControls = ReturnType<typeof useTimerEngine>['controls']
export type TimerDisplay = ReturnType<typeof useTimerEngine>['display']

export type StudyTimerShellValue = Omit<ReturnType<typeof useStudyTimerState>, 'timerDisplay'>

export const StudyTimerContext = createContext<StudyTimerShellValue | null>(null)
export const StudyTimerDisplayContext = createContext<TimerDisplay | null>(null)

export function useStudyTimerContext() {
  const ctx = useContext(StudyTimerContext)
  if (!ctx) throw new Error('useStudyTimerContext must be used within StudyTimerProvider')
  return ctx
}

export function useStudyTimerControls() {
  const ctx = useStudyTimerContext()
  return ctx.timerControls
}

export function useStudyTimerDisplay() {
  const ctx = useContext(StudyTimerDisplayContext)
  if (!ctx) throw new Error('useStudyTimerDisplay must be used within StudyTimerProvider')
  return ctx
}
