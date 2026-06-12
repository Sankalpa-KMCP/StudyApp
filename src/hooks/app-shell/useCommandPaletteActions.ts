import { useCallback } from 'react'
import type { CommandPaletteSelection } from '../../components/CommandPalette'
import type { TaskItem } from '../../db/types'
import { scrollToSettingsSectionWhenReady } from '../../lib/settings/settingsSections'
import { setFlashcardReviewPending } from '../../lib/study/flashcardReviewPending'
import { queueJournalDateNavigation } from '../../lib/routing/journalNavigation'
import type { ActiveTab } from '../../types/app'

interface UseCommandPaletteActionsOptions {
  tasks: TaskItem[]
  timerControls: {
    setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>
  }
  backup: {
    exportStudyBackup: (options?: { destination?: 'download' }) => Promise<void>
  }
  backupReminder: { refresh: () => void }
  activateTask: (task: TaskItem) => void
  setActiveTab: (tab: ActiveTab) => void | Promise<void>
  setIsZenMode: React.Dispatch<React.SetStateAction<boolean>>
  setIsHotkeyHudOpen: (open: boolean) => void
  setFocusNoteId: (id: number | null) => void
  setIsNotesOpen: (open: boolean) => void
}

export function useCommandPaletteActions({
  tasks,
  timerControls,
  backup,
  backupReminder,
  activateTask,
  setActiveTab,
  setIsZenMode,
  setIsHotkeyHudOpen,
  setFocusNoteId,
  setIsNotesOpen,
}: UseCommandPaletteActionsOptions) {
  return useCallback((selection: CommandPaletteSelection) => {
    if (selection.actionId) {
      switch (selection.actionId) {
        case 'toggle-timer':
          timerControls.setIsTimerActive(active => !active)
          break
        case 'toggle-zen':
          setIsZenMode(zen => !zen)
          break
        case 'export-backup':
          void backup.exportStudyBackup({ destination: 'download' }).then(() => backupReminder.refresh())
          break
        case 'open-hotkeys':
          setIsHotkeyHudOpen(true)
          break
        case 'review-due-cards':
          setFlashcardReviewPending()
          void setActiveTab('cards')
          break
        case 'add-task':
          void setActiveTab('focus')
          break
      }
    }
    if (selection.tab) void setActiveTab(selection.tab)
    if (selection.settingsSection) {
      void setActiveTab('settings')
      scrollToSettingsSectionWhenReady(selection.settingsSection)
    }
    if (selection.taskId != null) {
      const task = tasks.find(t => t.id === selection.taskId)
      if (task) {
        void setActiveTab('focus')
        activateTask(task)
      }
    }
    if (selection.noteId != null) {
      setFocusNoteId(selection.noteId)
      setIsNotesOpen(true)
    }
    if (selection.flashcardId != null) {
      setFlashcardReviewPending()
      void setActiveTab('cards')
    }
    if (selection.journalDate) {
      queueJournalDateNavigation(selection.journalDate)
      void setActiveTab('journal')
    }
  }, [
    tasks,
    timerControls,
    backup,
    backupReminder,
    activateTask,
    setActiveTab,
    setIsZenMode,
    setIsHotkeyHudOpen,
    setFocusNoteId,
    setIsNotesOpen,
  ])
}
