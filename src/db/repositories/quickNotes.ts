import { db } from '../db'
import type { QuickNoteItem } from '../types'

export async function addNote(title: string, content: string, categoryId?: number) {
  return db.quick_notes.add({
    title,
    content,
    categoryId,
    color: '#06b6d4',
    updatedAt: Date.now(),
  })
}

export async function updateNote(id: number, title: string, content: string, categoryId?: number, color?: string) {
  await db.quick_notes.update(id, {
    title,
    content,
    categoryId,
    color,
    updatedAt: Date.now(),
  })
}

export async function deleteNote(id: number) {
  await db.quick_notes.delete(id)
}

export async function restoreNote(note: QuickNoteItem): Promise<void> {
  await db.quick_notes.put(note)
}

export async function getAllNotes() {
  return db.quick_notes.toArray()
}
