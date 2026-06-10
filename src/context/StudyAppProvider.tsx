import type { ReactNode } from 'react'
import { StudyAppContext } from './studyAppContext'
import { useStudyAppState } from './useStudyAppState'

export function StudyAppProvider({ children }: { children: ReactNode }) {
  const value = useStudyAppState()
  return <StudyAppContext.Provider value={value}>{children}</StudyAppContext.Provider>
}
