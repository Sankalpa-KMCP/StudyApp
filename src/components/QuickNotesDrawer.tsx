import React, { useState, useEffect, useRef, useMemo } from 'react'
import { X, Plus, Trash2, Edit3, Search, Check, Save } from 'lucide-react'
import type { CategoryItem, QuickNoteItem } from '../db/types'

interface QuickNotesDrawerProps {
  isOpen: boolean
  onClose: () => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<void> | void
  deleteCategory: (id: number) => Promise<void> | void
  notes: QuickNoteItem[]
  addNote: (title: string, content: string, categoryId?: number) => Promise<void>
  updateNote: (id: number, title: string, content: string, categoryId?: number, color?: string) => Promise<void>
  deleteNote: (id: number) => Promise<void>
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
  deleteNote
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<'all' | number>('all')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  
  // Local edit states
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<number | undefined>(undefined)
  const [editColor, setEditColor] = useState('#06b6d4')
  
  // Category manager inline states
  const [showCatManager, setShowCatManager] = useState(false)
  const [inlineCatName, setInlineCatName] = useState('')
  const [inlineCatColor, setInlineCatColor] = useState('#3B82F6')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  
  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  // Auto-save debouncing logic
  const triggerAutoSave = (id: number, t: string, c: string, catId?: number, col?: string) => {
    setSaveStatus('saving')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    
    autoSaveTimerRef.current = setTimeout(async () => {
      await updateNote(id, t, c, catId, col)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 500) // 500ms debounce
  }

  const handleTitleChange = (val: string) => {
    setEditTitle(val)
    if (editingNoteId !== null) {
      triggerAutoSave(editingNoteId, val, editContent, editCategoryId, editColor)
    }
  }

  const handleContentChange = (val: string) => {
    setEditContent(val)
    if (editingNoteId !== null) {
      triggerAutoSave(editingNoteId, editTitle, val, editCategoryId, editColor)
    }
  }

  const handleCategoryChange = (val: number | undefined) => {
    setEditCategoryId(val)
    if (editingNoteId !== null) {
      triggerAutoSave(editingNoteId, editTitle, editContent, val, editColor)
    }
  }

  const handleColorChange = (val: string) => {
    setEditColor(val)
    if (editingNoteId !== null) {
      triggerAutoSave(editingNoteId, editTitle, editContent, editCategoryId, val)
    }
  }

  const handleCreateNote = async () => {
    await addNote('New Scratch Note', '', activeCategoryId !== 'all' ? activeCategoryId : undefined)
    // Small timeout to let IndexedDB update and find the latest card
    setTimeout(() => {
      const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
      if (sorted.length > 0) {
        const latest = sorted[0]
        if (latest && latest.id !== undefined) {
          startEditing(latest)
        }
      }
    }, 100)
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
      // Force immediate final save
      if (editingNoteId !== null) {
        updateNote(editingNoteId, editTitle, editContent, editCategoryId, editColor)
      }
    }
    setEditingNoteId(null)
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (editingNoteId === id) {
      setEditingNoteId(null)
    }
    await deleteNote(id)
  }

  const categoriesMap = useMemo(() => {
    const map = new Map<number, CategoryItem>()
    categories.forEach(c => {
      if (c.id !== undefined) map.set(c.id, c)
    })
    return map
  }, [categories])

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const cat = n.categoryId !== undefined ? categoriesMap.get(n.categoryId) : undefined
      const catName = cat ? cat.name.toLowerCase() : ''
      
      const tagsInQuery = searchQuery.match(/#(\w+)/g)
      let matchesSearch = true
      
      if (tagsInQuery) {
        const tagNames = tagsInQuery.map(t => t.substring(1).toLowerCase())
        const matchesTags = tagNames.every(tn => catName.replace(/\s+/g, '').includes(tn))
        
        const cleanQuery = searchQuery.replace(/#\w+/g, '').trim().toLowerCase()
        const matchesText = cleanQuery === '' || 
                            n.title.toLowerCase().includes(cleanQuery) || 
                            n.content.toLowerCase().includes(cleanQuery)
        
        matchesSearch = matchesTags && matchesText
      } else {
        const q = searchQuery.toLowerCase()
        matchesSearch = n.title.toLowerCase().includes(q) || 
                        n.content.toLowerCase().includes(q) ||
                        catName.includes(q)
      }
      
      const matchesCategory = activeCategoryId === 'all' || n.categoryId === activeCategoryId
      return matchesSearch && matchesCategory
    })
  }, [notes, searchQuery, activeCategoryId, categoriesMap])

  const notePaletteColors = [
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444'  // red
  ]

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#07090f]/90 border-l border-white/10 backdrop-blur-2xl shadow-2xl transition-transform duration-500 ease-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/20 select-none">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-accent-blue" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Notes Workspace</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Editing panel */}
      {editingNoteId !== null ? (
        <div className="flex-1 flex flex-col min-h-0 bg-[#090b14]/50 animate-fade-in">
          {/* Editor Header / Save Status */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/10 text-[10px] font-mono text-slate-500 select-none">
            <button
              onClick={stopEditing}
              className="px-2 py-1 rounded hover:bg-white/5 text-accent-blue font-bold cursor-pointer"
            >
              ← Back to list
            </button>
            <div className="flex items-center gap-1.5 font-bold uppercase">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-accent-amber animate-pulse">
                  <Save className="h-3 w-3" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-accent-green">
                  <Check className="h-3 w-3" />
                  Auto-Saved
                </span>
              )}
              {saveStatus === 'idle' && <span className="text-white/30">Synced</span>}
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
            {/* Title */}
            <input
              type="text"
              value={editTitle}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Note Title"
              className="bg-transparent text-sm font-bold text-white border-b border-white/5 focus:border-white/20 pb-2 outline-none w-full placeholder-white/25"
            />

            {/* Note category and color picks */}
            <div className="grid grid-cols-2 gap-3.5 bg-black/20 border border-white/5 p-3 rounded-xl select-none">
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-1 select-none">
                  <label className="text-[8px] font-mono uppercase text-white/45">Category</label>
                  <button
                    type="button"
                    onClick={() => setShowCatManager(!showCatManager)}
                    className="text-[8px] font-bold text-accent-blue hover:underline cursor-pointer"
                  >
                    {showCatManager ? 'Done' : '✏️ Manage'}
                  </button>
                </div>
                
                {showCatManager ? (
                  <div className="space-y-1.5 bg-black/30 border border-white/5 p-2 rounded-lg animate-fade-in mb-1">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={inlineCatName}
                        onChange={e => setInlineCatName(e.target.value)}
                        placeholder="New label..."
                        className="flex-1 rounded bg-white/5 border border-white/8 px-2 py-1 text-[9px] text-white placeholder-white/20 outline-none"
                      />
                      <input
                        type="color"
                        value={inlineCatColor}
                        onChange={e => setInlineCatColor(e.target.value)}
                        className="h-5.5 w-5.5 shrink-0 cursor-pointer rounded-full border border-white/10 bg-[#0c0f17] p-0"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const name = inlineCatName.trim()
                          if (name) {
                            await addCategory(name, inlineCatColor)
                            setInlineCatName('')
                          }
                        }}
                        className="px-2 rounded bg-accent-blue text-white text-[9px] font-bold transition-all cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="max-h-20 overflow-y-auto custom-scrollbar space-y-1 pr-1 border-t border-white/5 pt-1.5">
                      {categories.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-[8px] font-semibold bg-white/5 px-2 py-1 rounded">
                          <div className="flex items-center gap-1 truncate">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="text-white/80 truncate">{c.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (c.id !== undefined) await deleteCategory(c.id)
                            }}
                            className="text-white/40 hover:text-red-400 font-bold transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <select
                    value={editCategoryId ?? ''}
                    onChange={e => handleCategoryChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full bg-black/50 border border-white/5 rounded-lg text-[10px] text-white p-1 outline-none cursor-pointer"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[8px] font-mono uppercase text-white/45 mb-1.5">Color Tag</label>
                <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                  {notePaletteColors.map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className="h-3 w-3 rounded-full shrink-0 border border-black/20 transition-transform hover:scale-125 cursor-pointer relative flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      {editColor === color && <span className="h-1 w-1 rounded-full bg-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content text */}
            <textarea
              value={editContent}
              onChange={e => handleContentChange(e.target.value)}
              placeholder="Type note details here..."
              className="flex-1 bg-transparent text-xs text-white/90 placeholder-white/25 outline-none resize-none min-h-[300px] leading-relaxed"
            />
          </div>
        </div>
      ) : (
        /* Notes List panel */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Controls bar */}
          <div className="p-3 border-b border-white/5 flex flex-col gap-2 bg-black/10 select-none">
            {/* Search Input */}
            <div className="relative flex items-center bg-white/[0.02] border border-white/5 rounded-xl px-2.5 py-1.5 focus-within:border-white/10 transition-all">
              <Search className="h-3.5 w-3.5 text-slate-500 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search notes or use #tag..."
                className="bg-transparent text-xs text-white outline-none w-full placeholder-white/20"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white cursor-pointer p-0.5">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Notes Search by Category Tag Suggestions */}
            {searchFocused && categories.length > 0 && (
              <div className="flex flex-wrap gap-1 bg-black/40 border border-white/5 p-2 rounded-xl animate-fade-in">
                <span className="text-[8px] font-mono text-slate-450 w-full mb-0.5">Quick tag search tags:</span>
                {categories.map(c => {
                  const tagText = `#${c.name.replace(/\s+/g, '')}`
                  const isActive = searchQuery.includes(tagText)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => {
                        // Prevent input from losing focus
                        e.preventDefault()
                      }}
                      onClick={() => {
                        if (isActive) {
                          setSearchQuery(prev => prev.replace(tagText, '').replace(/\s+/g, ' ').trim())
                        } else {
                          setSearchQuery(prev => `${prev} ${tagText}`.replace(/\s+/g, ' ').trim())
                        }
                      }}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                        isActive 
                          ? 'text-white border-white/20' 
                          : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      style={{ borderLeftColor: c.color, borderLeftWidth: '3px' }}
                    >
                      {tagText}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Category selection */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategoryId('all')}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border shrink-0 transition-all cursor-pointer ${
                  activeCategoryId === 'all'
                    ? 'bg-white/10 text-white border-white/10'
                    : 'bg-white/[0.01] text-white/40 border-white/5 hover:text-white'
                }`}
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => c.id !== undefined && setActiveCategoryId(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeCategoryId === c.id
                      ? 'text-white border-white/15'
                      : 'bg-white/[0.01] text-white/40 border-white/5 hover:text-white'
                  }`}
                  style={activeCategoryId === c.id ? { backgroundColor: `${c.color}15`, borderColor: c.color } : {}}
                >
                  <span className="h-1 w-1 rounded-full animate-pulse-soft" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Note tiles list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
            {filteredNotes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-2xl bg-black/10 my-1">
                <Edit3 className="h-8 w-8 text-white/20 mb-3 animate-pulse" />
                <p className="text-xs text-white/40 select-none uppercase font-mono tracking-wider">Empty Notes Workspace</p>
                <p className="text-[10px] text-slate-500 mt-1.5 select-none leading-relaxed">No note logs matches the current criteria.</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const cat = note.categoryId !== undefined ? categoriesMap.get(note.categoryId) : undefined
                const updatedTimeStr = new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return (
                  <div
                    key={note.id}
                    onClick={() => startEditing(note)}
                    className="group relative p-3.5 rounded-xl border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] hover:border-white/10 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col gap-2.5 overflow-hidden"
                  >
                    {/* Left color bar glow indicator */}
                    <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: note.color || '#06b6d4' }} />

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        {cat && (
                          <span
                            className="inline-block text-[8px] font-bold px-1.5 py-0.5 rounded border font-mono select-none"
                            style={{ backgroundColor: `${cat.color}10`, borderColor: `${cat.color}25`, color: cat.color }}
                          >
                            {cat.name}
                          </span>
                        )}
                        <h4 className="text-xs font-bold text-white leading-normal truncate pr-2 select-none">
                          {note.title || 'Untitled note'}
                        </h4>
                      </div>

                      <button
                        onClick={(e) => note.id !== undefined && handleDelete(note.id, e)}
                        className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5 cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Content preview */}
                    <p className="text-[10px] text-slate-450 leading-relaxed truncate select-none italic">
                      {note.content ? note.content : 'No additional scratch details.'}
                    </p>

                    {/* Footer log */}
                    <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 select-none">
                      <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                      <span>{updatedTimeStr}</span>
                    </div>

                  </div>
                )
              })
            )}
          </div>

          {/* Workspace additions bar */}
          <div className="p-3 border-t border-white/5 bg-black/20 flex select-none">
            <button
              onClick={handleCreateNote}
              className="w-full py-2 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Create Note</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
