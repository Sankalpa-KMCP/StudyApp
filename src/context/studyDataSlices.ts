import { createContext, useContext } from 'react'
import type { useStudyDataState } from './useStudyDataState'

type StudyDataState = ReturnType<typeof useStudyDataState>

export type StudyCoreSlice = Pick<
  StudyDataState,
  'isDataReady' | 'tasks' | 'history' | 'recentHistory' | 'settings' | 'todayLog' | 'categories' | 'progress'
>

export type StudyGamificationSlice = Pick<
  StudyDataState,
  'currentStreak' | 'xpData' | 'pendingLevelUp' | 'dismissLevelUp'
>

export type StudyExtendedSlice = Pick<
  StudyDataState,
  'flashcards' | 'quickNotes' | 'allLogs' | 'insights' | 'breakdownData' | 'analyticsRange' | 'journal'
>

export const StudyCoreContext = createContext<StudyCoreSlice | null>(null)
export const StudyGamificationContext = createContext<StudyGamificationSlice | null>(null)
export const StudyExtendedContext = createContext<StudyExtendedSlice | null>(null)

export function useStudyCore() {
  const ctx = useContext(StudyCoreContext)
  if (!ctx) throw new Error('useStudyCore must be used within StudyDataProvider')
  return ctx
}

export function useStudyGamification() {
  const ctx = useContext(StudyGamificationContext)
  if (!ctx) throw new Error('useStudyGamification must be used within StudyDataProvider')
  return ctx
}

export function useStudyExtended() {
  const ctx = useContext(StudyExtendedContext)
  if (!ctx) throw new Error('useStudyExtended must be used within StudyDataProvider')
  return ctx
}
