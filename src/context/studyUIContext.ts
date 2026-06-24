import { createContext, useContext } from 'react'
import type { ThemeProfile } from '../types/app'
import type { useStudyUIState } from './useStudyUIState'

export type StudyUIContextValue = ReturnType<typeof useStudyUIState> & {
  activeThemeVars: ThemeProfile
  handleDeleteNote: (id: number) => Promise<void>
}

export const StudyUIContext = createContext<StudyUIContextValue | null>(null)

export function useStudyUIContext() {
  const ctx = useContext(StudyUIContext)
  if (!ctx) throw new Error('useStudyUIContext must be used within StudyUIProvider')
  return ctx
}
