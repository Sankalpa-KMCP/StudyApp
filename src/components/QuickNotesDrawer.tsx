import React, { useEffect } from 'react'
import { X, Edit3 } from 'lucide-react'
import type { CategoryItem, QuickNoteItem } from '../db/types'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useNoteFilters } from './quick-notes/useNoteFilters'
import { useNoteEditor } from './quick-notes/useNoteEditor'
import { useConfirm } from '../context/useConfirm'
import { QUICK_NOTES_HELPER } from '../lib/shared/uxTerms'
import { NoteEditorPanel } from './quick-notes/NoteEditorPanel'
import { NoteListPanel } from './quick-notes/NoteListPanel'

interface QuickNotesDrawerProps {
  isOpen: boolean
  onClose: () => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number | void> | number | void
  deleteCategory: (id: number) => Promise<void> | void
  notes: QuickNoteItem[]
  addNote: (title: string, content: string, categoryId?: number) => Promise<number>
  updateNote: (id: number, title: string, content: string, categoryId?: number, color?: string) => Promise<void>
  deleteNote: (id: number) => Promise<void>
  noteTagColors: string[]
  focusNoteId?: number | null
}

export const QuickNotesDrawer: React.FC<QuickNotesDrawerProps> = ({
  isOpen,
  onClose,
  categories,
  addCategory,
  deleteCategory,
  notes,
  addNote,
  updateNote,
  deleteNote,
  noteTagColors,
  focusNoteId,
}) => {
  const { requestConfirm } = useConfirm()
  const trapRef = useFocusTrap(isOpen, onClose)
  const filters = useNoteFilters(notes, categories)
  const editor = useNoteEditor(updateNote)

  useEffect(() => {
    if (!isOpen || focusNoteId == null) return
    const note = notes.find(n => n.id === focusNoteId)
    if (note) editor.startEditing(note)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- startEditing is stable enough for focus jump
  }, [isOpen, focusNoteId, notes])

  const handleCreateNote = async () => {
    const noteId = await addNote(
      'New Scratch Note',
      '',
      filters.activeCategoryId !== 'all' ? filters.activeCategoryId : undefined,
    )
    const created = notes.find(note => note.id === noteId)
    if (created) {
      editor.startEditing(created)
      return
    }
    editor.startEditing({
      id: noteId,
      title: 'New Scratch Note',
      content: '',
      categoryId: filters.activeCategoryId !== 'all' ? filters.activeCategoryId : undefined,
      color: '#06b6d4',
      updatedAt: Date.now(),
    })
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (editor.editingNoteId === id) {
      editor.setEditingNoteId(null)
    }
    await deleteNote(id)
  }

  if (!isOpen) return null

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-notes-title"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[color-mix(in_srgb,var(--body-base)_92%,transparent)] border-l border-white/10 backdrop-blur-2xl shadow-2xl transition-transform duration-500 ease-out flex flex-col translate-x-0"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 select-none">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-accent-blue shrink-0" />
          <div className="flex flex-col min-w-0">
            <h3 id="quick-notes-title" className="text-xs font-bold uppercase tracking-wider text-white">Quick Notes</h3>
            <p className="text-[10px] text-white/45 font-medium normal-case tracking-normal">{QUICK_NOTES_HELPER}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick notes"
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {editor.editingNoteId !== null ? (
        <NoteEditorPanel
          categories={categories}
          addCategory={addCategory}
          deleteCategory={deleteCategory}
          requestConfirm={requestConfirm}
          noteTagColors={noteTagColors}
          editor={editor}
        />
      ) : (
        <NoteListPanel
          categories={categories}
          filteredNotes={filters.filteredNotes}
          categoriesMap={filters.categoriesMap}
          filters={filters}
          onStartEditing={editor.startEditing}
          onDelete={(id, e) => { void handleDelete(id, e) }}
          onCreateNote={() => { void handleCreateNote() }}
        />
      )}
    </div>
  )
}
