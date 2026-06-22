import { useMemo } from 'react'
import { useStudyUIState } from './useStudyUIState'
import { useStudyCore } from './studyDataSlices'
import type { StudyUIContextValue } from './studyUIContext'
import { useStudyThemeEffects } from '../hooks/theme/useStudyThemeEffects'
import { useActiveTabSync as useActiveTabHashSync } from '../hooks/routing/useActiveTabSync'
import type { useAppToast } from '../hooks/useAppToast'

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIProviderValue(toast: ToastApi): StudyUIContextValue {
  const uiState = useStudyUIState(toast)
  const { settings } = useStudyCore()
  const activeThemeVars = useStudyThemeEffects(settings)

  useActiveTabHashSync({
    activeTab: uiState.activeTab,
    navigateToTab: uiState.setActiveTab,
  })

  return useMemo(
    (): StudyUIContextValue => ({ ...uiState, activeThemeVars }),
    [uiState, activeThemeVars],
  )
}
