import { Check, Save } from 'lucide-react'
import type { CategoryItem } from '../../db/types'
import { InlineCategoryManager } from '../shared/InlineCategoryManager'
import { useTranslation } from '../../i18n/useTranslation'
import type { useNoteEditor } from '../../hooks/quick-notes/useNoteEditor'

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
  const { t } = useTranslation()
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
    <div className="flex-1 flex flex-col min-h-0 surface-subtle animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2 border-b border-card surface-subtle text-micro font-mono text-muted select-none">
        <button
          type="button"
          onClick={stopEditing}
          className="focus-ring px-2 py-1 rounded-lg hover:surface-subtle text-accent-blue font-bold cursor-pointer"
        >
          ← {t('notesBackToList')}
        </button>
        <div className="flex items-center gap-1.5 font-bold uppercase">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-accent-amber animate-pulse">
              <Save className="h-3 w-3" aria-hidden />
              {t('notesSaving')}
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-accent-green">
              <Check className="h-3 w-3" aria-hidden />
              {t('notesAutoSaved')}
            </span>
          )}
          {saveStatus === 'idle' && <span className="text-muted">{t('notesSynced')}</span>}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
        <input
          type="text"
          value={editTitle}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder={t('notesTitlePlaceholder')}
          className="focus-ring bg-transparent text-sm font-bold text-primary border-b border-card focus:border-accent-blue/40 pb-2 outline-none w-full placeholder:text-muted rounded-sm"
        />

        <div className="grid grid-cols-2 gap-3.5 surface-subtle border border-card p-3 rounded-xl select-none">
          <InlineCategoryManager
            label={t('notesCategoryLabel')}
            categories={categories}
            addCategory={addCategory}
            deleteCategory={deleteCategory}
            requestConfirm={requestConfirm}
            selectedCategoryId={editCategoryId}
            onSelectCategory={handleCategoryChange}
          />

          <div>
            <span id="note-color-tag" className="block text-[8px] font-mono uppercase text-muted mb-1.5">
              {t('notesColorTagLabel')}
            </span>
            <div className="flex items-center gap-1 overflow-x-auto max-w-full" role="group" aria-labelledby="note-color-tag">
              {noteTagColors.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorChange(color)}
                  aria-pressed={editColor === color}
                  aria-label={t('notesTagColorSelectAria', { index: index + 1 })}
                  className="focus-ring h-3 w-3 rounded-full shrink-0 border border-black/20 transition-transform hover:scale-125 cursor-pointer relative flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  {editColor === color && <span className="h-1 w-1 rounded-full bg-white" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={editContent}
          onChange={e => handleContentChange(e.target.value)}
          placeholder={t('notesContentPlaceholder')}
          className="focus-ring flex-1 bg-transparent text-xs text-secondary placeholder:text-muted outline-none resize-none min-h-[300px] leading-relaxed rounded-lg border border-transparent focus:border-accent-blue/40 p-1 -m-1"
        />
      </div>
    </div>
  )
}
