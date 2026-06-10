import { useEffect, useRef, useState } from 'react'
import type { QuickNoteItem } from '../../db/types'

export function useNoteEditor(
  updateNote: (id: number, title: string, content: string, categoryId?: number, color?: string) => Promise<void>,
) {
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined)
  const [editColor, setEditColor] = useState('#06b6d4')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  const triggerAutoSave = (id: number, t: string, c: string, catId?: number, col?: string) => {
    setSaveStatus('saving')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      await updateNote(id, t, c, catId, col)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 500)
  }

  const handleTitleChange = (val: string) => {
    setEditTitle(val)
    if (editingNoteId !== null) triggerAutoSave(editingNoteId, val, editContent, editCategoryId, editColor)
  }

  const handleContentChange = (val: string) => {
    setEditContent(val)
    if (editingNoteId !== null) triggerAutoSave(editingNoteId, editTitle, val, editCategoryId, editColor)
  }

  const handleCategoryChange = (val: number | undefined) => {
    setEditCategoryId(val)
    if (editingNoteId !== null) triggerAutoSave(editingNoteId, editTitle, editContent, val, editColor)
  }

  const handleColorChange = (val: string) => {
    setEditColor(val)
    if (editingNoteId !== null) triggerAutoSave(editingNoteId, editTitle, editContent, editCategoryId, val)
  }

  const startEditing = (note: QuickNoteItem) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    setEditingNoteId(note.id!)
    setEditTitle(note.title)
    setEditContent(note.content)
    setEditCategoryId(note.categoryId)
    setEditColor(note.color ?? '#06b6d4')
    setSaveStatus('idle')
  }

  const stopEditing = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      if (editingNoteId !== null) {
        updateNote(editingNoteId, editTitle, editContent, editCategoryId, editColor)
      }
    }
    setEditingNoteId(null)
  }

  return {
    editingNoteId,
    setEditingNoteId,
    editTitle,
    editContent,
    editCategoryId,
    editColor,
    saveStatus,
    handleTitleChange,
    handleContentChange,
    handleCategoryChange,
    handleColorChange,
    startEditing,
    stopEditing,
  }
}
