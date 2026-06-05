import { createContext, useContext } from 'react'
import type { useStudyDataState } from './useStudyDataState'

export type StudyDataContextValue = ReturnType<typeof useStudyDataState>

export const StudyDataContext = createContext<StudyDataContextValue | null>(null)

export function useStudyDataContext() {
  const ctx = useContext(StudyDataContext)
  if (!ctx) throw new Error('useStudyDataContext must be used within StudyDataProvider')
  return ctx
}
