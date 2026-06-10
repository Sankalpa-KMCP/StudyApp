import { createContext } from 'react'
import type { useStudyAppState } from './useStudyAppState'

export type StudyAppContextValue = ReturnType<typeof useStudyAppState>

export const StudyAppContext = createContext<StudyAppContextValue | null>(null)
