import type { ReactNode } from 'react'
import { StudyDataContext } from './studyDataContext'
import { useStudyDataState } from './useStudyDataState'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function StudyDataProvider({ children, pushToast }: { children: ReactNode; pushToast: PushToast }) {
  const value = useStudyDataState(pushToast)
  return (
    <StudyDataContext.Provider value={value}>
      {children}
    </StudyDataContext.Provider>
  )
}
