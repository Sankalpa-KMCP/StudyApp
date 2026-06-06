import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { QuickNoteItem } from '../types'
import * as notesRepo from '../repositories/quickNotes'

export function useQuickNotes() {
  const notes = useLiveQuery<QuickNoteItem[]>(() => db.quick_notes.orderBy('updatedAt').reverse().toArray())

  return {
    notes: notes ?? [],
    addNote: notesRepo.addNote,
    updateNote: notesRepo.updateNote,
    deleteNote: notesRepo.deleteNote,
    isLoading: notes === undefined,
  }
}
