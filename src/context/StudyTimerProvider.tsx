import type { ReactNode } from 'react'
import { StudyTimerContext } from './studyTimerContext'
import { useStudyTimerState } from './useStudyTimerState'
import type { useAppToast } from '../hooks/useAppToast'

type PushToast = ReturnType<typeof useAppToast>['pushToast']

export function StudyTimerProvider({ children, pushToast }: { children: ReactNode; pushToast: PushToast }) {
  const value = useStudyTimerState(pushToast)
  return (
    <StudyTimerContext.Provider value={value}>
      {children}
    </StudyTimerContext.Provider>
  )
}
