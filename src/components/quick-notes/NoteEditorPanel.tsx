import { Check, Save } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'
import type { useNoteEditor } from './useNoteEditor'

type NoteEditorApi = ReturnType<typeof useNoteEditor>

interface NoteEditorPanelProps {
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => Promise<number | void> | number | void
  deleteCategory: (id: number) => Promise<void> | void
  requestConfirm: ReturnType<typeof import('../../context/useConfirm').useConfirm>['requestConfirm']
  noteTagColors: string[]
  editor: NoteEditorApi
}

export function NoteEditorPanel({
  categories,
  addCategory,
  deleteCategory,
  requestConfirm,
  noteTagColors,
  editor,
}: NoteEditorPanelProps) {
  const {
    editTitle,
    editContent,
    editCategoryId,
    editColor,
    saveStatus,
    handleTitleChange,
    handleContentChange,
    handleCategoryChange,
    handleColorChange,
    stopEditing,
  } = editor

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090b14]/50 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2 border-b border-card surface-subtle text-micro font-mono text-muted select-none">
        <button
          onClick={stopEditing}
          className="px-2 py-1 rounded hover:surface-subtle text-accent-blue font-bold cursor-pointer"
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
          {saveStatus === 'idle' && <span className="text-muted">Synced</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
        <input
          type="text"
          value={editTitle}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Note Title"
          className="bg-transparent text-sm font-bold text-primary border-b border-card focus:border-card pb-2 outline-none w-full placeholder:text-muted"
        />

        <div className="grid grid-cols-2 gap-3.5 surface-subtle border border-card p-3 rounded-xl select-none">
          <InlineCategoryManager
            label="Category"
            categories={categories}
            addCategory={addCategory}
            deleteCategory={deleteCategory}
            requestConfirm={requestConfirm}
            selectedCategoryId={editCategoryId}
            onSelectCategory={handleCategoryChange}
          />

          <div>
            <span id="note-color-tag" className="block text-[8px] font-mono uppercase text-muted mb-1.5">Color Tag</span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full" role="group" aria-labelledby="note-color-tag">
              {noteTagColors.map(color => (
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

        <textarea
          value={editContent}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="Type note details here..."
          className="flex-1 bg-transparent text-xs text-secondary placeholder:text-muted outline-none resize-none min-h-[300px] leading-relaxed"
        />
      </div>
    </div>
  )
}
