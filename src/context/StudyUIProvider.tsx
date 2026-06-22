import type { ReactNode } from 'react'
import { StudyUIContext } from './studyUIContext'
import { useStudyUIProviderValue } from './useStudyUIProviderValue'
import type { useAppToast } from '../hooks/useAppToast'

type ToastApi = ReturnType<typeof useAppToast>

export function StudyUIProvider({ children, toast }: { children: ReactNode; toast: ToastApi }) {
  const value = useStudyUIProviderValue(toast)
  return (
    <StudyUIContext.Provider value={value}>
      {children}
    </StudyUIContext.Provider>
  )
}
