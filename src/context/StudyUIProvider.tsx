import type { ReactNode } from 'react'
import { StudyUIContext } from './studyUIContext'
import { useStudyUIState } from './useStudyUIState'
import type { useAppToast } from '../hooks/useAppToast'

type ToastApi = ReturnType<typeof useAppToast>

export function StudyUIProvider({ children, toast }: { children: ReactNode; toast: ToastApi }) {
  const value = useStudyUIState(toast)
  return (
    <StudyUIContext.Provider value={value}>
      {children}
    </StudyUIContext.Provider>
  )
}
