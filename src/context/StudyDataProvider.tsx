import type { ReactNode } from 'react'
import { useActiveTabSync } from '../lib/routing/activeTabSync'
import { StudyDataContext } from './studyDataContext'
import { useStudyDataState } from './useStudyDataState'

export function StudyDataProvider({ children }: { children: ReactNode }) {
  const activeTab = useActiveTabSync()
  const value = useStudyDataState(activeTab)
  return (
    <StudyDataContext.Provider value={value}>
      {children}
    </StudyDataContext.Provider>
  )
}
