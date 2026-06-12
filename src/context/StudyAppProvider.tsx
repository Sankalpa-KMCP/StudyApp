import type { ReactNode } from 'react'
import { useAppToast } from '../hooks/useAppToast'
import { ConfirmProvider } from './ConfirmProvider'
import { StudyDataProvider } from './StudyDataProvider'
import { StudyTimerProvider } from './StudyTimerProvider'
import { StudyUIProvider } from './StudyUIProvider'

export function StudyAppProvider({ children }: { children: ReactNode }) {
  const toast = useAppToast()

  return (
    <ConfirmProvider>
      <StudyDataProvider>
        <StudyTimerProvider pushToast={toast.pushToast}>
          <StudyUIProvider toast={toast}>
            {children}
          </StudyUIProvider>
        </StudyTimerProvider>
      </StudyDataProvider>
    </ConfirmProvider>
  )
}
