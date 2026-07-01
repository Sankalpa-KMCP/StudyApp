import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { QuickNoteItem } from '../types'
import * as notesRepo from '../repositories/quickNotes'

export function useQuickNotes(enabled = true) {
  const notes = useLiveQuery<QuickNoteItem[]>(() => {
    if (!enabled) return Promise.resolve([])
    return db.quick_notes.orderBy('updatedAt').reverse().toArray()
  }, [enabled])

  return {
    notes: notes ?? [],
    addNote: notesRepo.addNote,
    updateNote: notesRepo.updateNote,
    deleteNote: notesRepo.deleteNote,
    isLoading: enabled ? notes === undefined : false,
  }
}
