import { createContext, useContext } from 'react'
import type { useStudyTimerState } from './useStudyTimerState'

export type StudyTimerContextValue = ReturnType<typeof useStudyTimerState>

export const StudyTimerContext = createContext<StudyTimerContextValue | null>(null)

export function useStudyTimerContext() {
  const ctx = useContext(StudyTimerContext)
  if (!ctx) throw new Error('useStudyTimerContext must be used within StudyTimerProvider')
  return ctx
}
