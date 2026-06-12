import { useCallback } from 'react'
import { restoreNote } from '../../db/repositories/quickNotes'
import type { QuickNoteItem } from '../../db/types'

interface UseNoteDeleteUndoOptions {
  notes: QuickNoteItem[]
  deleteNote: (id: number) => Promise<void>
  scheduleDelete: (
    label: string,
    onDelete: () => void | Promise<void>,
    onUndo: () => void | Promise<void>,
  ) => void
}

export function useNoteDeleteUndo({ notes, deleteNote, scheduleDelete }: UseNoteDeleteUndoOptions) {
  const handleDeleteNote = useCallback(async (id: number) => {
    const note = notes.find(n => n.id === id)
    if (!note) {
      void deleteNote(id)
      return
    }
    scheduleDelete('Note', () => deleteNote(id), async () => { await restoreNote(note) })
  }, [notes, deleteNote, scheduleDelete])

  return { handleDeleteNote }
}
