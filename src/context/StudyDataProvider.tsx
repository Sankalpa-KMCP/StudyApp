import type { ReactNode } from 'react'
import { StudyDataContext } from './studyDataContext'
import { useStudyDataState } from './useStudyDataState'

export function StudyDataProvider({ children }: { children: ReactNode }) {
  const value = useStudyDataState()
  return (
    <StudyDataContext.Provider value={value}>
      {children}
    </StudyDataContext.Provider>
  )
}
