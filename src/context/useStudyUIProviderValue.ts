import { useMemo } from 'react'
import { useStudyUIState } from './useStudyUIState'
import { useStudyCore, useStudyExtended } from './studyDataSlices'
import type { StudyUIContextValue } from './studyUIContext'
import { useStudyThemeEffects } from '../hooks/theme/useStudyThemeEffects'
import { useActiveTabSync as useActiveTabHashSync } from '../hooks/routing/useActiveTabSync'
import { useNoteDeleteUndo } from '../hooks/app-shell/useNoteDeleteUndo'
import type { useAppToast } from '../hooks/useAppToast'

type ToastApi = ReturnType<typeof useAppToast>

export function useStudyUIProviderValue(toast: ToastApi): StudyUIContextValue {
  const uiState = useStudyUIState(toast)
  const { settings } = useStudyCore()
  const { quickNotes } = useStudyExtended()
  const activeThemeVars = useStudyThemeEffects(settings)
  const { handleDeleteNote } = useNoteDeleteUndo({
    notes: quickNotes.notes,
    deleteNote: quickNotes.deleteNote,
    scheduleDelete: uiState.scheduleDelete,
  })

  useActiveTabHashSync({
    activeTab: uiState.activeTab,
    navigateToTab: uiState.setActiveTab,
  })

  return useMemo(
    (): StudyUIContextValue => ({ ...uiState, activeThemeVars, handleDeleteNote }),
    [uiState, activeThemeVars, handleDeleteNote],
  )
}
