import { createContext, useContext } from 'react'
import type { useStudyUIState } from './useStudyUIState'

export type StudyUIContextValue = ReturnType<typeof useStudyUIState>

export const StudyUIContext = createContext<StudyUIContextValue | null>(null)

export function useStudyUIContext() {
  const ctx = useContext(StudyUIContext)
  if (!ctx) throw new Error('useStudyUIContext must be used within StudyUIProvider')
  return ctx
}
