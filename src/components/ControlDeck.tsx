import React, { useState } from 'react'
import { X } from 'lucide-react'
import type { CategoryItem, SettingsKey, SettingsValue } from '../db/types'
import { AestheticsPanel } from './control-deck/AestheticsPanel'
import { TimerFocusPanel } from './control-deck/TimerFocusPanel'
import { SoundFeedbackPanel } from './control-deck/SoundFeedbackPanel'
import { AlgorithmPanel } from './control-deck/AlgorithmPanel'
import { ZenLockoutPanel } from './control-deck/ZenLockoutPanel'
import { BackupVaultPanel } from './control-deck/BackupVaultPanel'

interface ControlDeckProps {
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
  theme: string
  cardOpacity: number
  backdropBlur: number
  initialEasinessFactor: number
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  soundEnabled: boolean
  tactileEnabled: boolean
  developerFont: string
  enforceLockout: boolean
  autoArchiveAncientTasks: boolean
  exportStudyBackup: () => void
  exportStudyLogsCSV: () => void
  exportTaskCompletionLogsCSV: () => void
  importStudyBackup: (val: string) => void
  resetData: () => void
  resetDataSelective: (options: { tasks: boolean; history: boolean; categories: boolean; cards: boolean; notes: boolean }) => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: number) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  handleFileDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  updateSetting,
  theme,
  cardOpacity,
  backdropBlur,
  initialEasinessFactor,
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  targetSessionsPerCycle,
  soundEnabled,
  tactileEnabled,
  developerFont,
  enforceLockout,
  autoArchiveAncientTasks,
  exportStudyBackup,
  exportStudyLogsCSV,
  exportTaskCompletionLogsCSV,
  importStudyBackup,
  resetData,
  resetDataSelective,
  categories,
  addCategory,
  deleteCategory,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full flex-1 items-start animate-fade-in">
      <div className="flex flex-col gap-6">
        <AestheticsPanel theme={theme} cardOpacity={cardOpacity} backdropBlur={backdropBlur} updateSetting={updateSetting} />
        <TimerFocusPanel
          dailyGoalMinutes={dailyGoalMinutes}
          studyBlockDurationMinutes={studyBlockDurationMinutes}
          shortBreakDurationMinutes={shortBreakDurationMinutes}
          longBreakDurationMinutes={longBreakDurationMinutes}
          targetSessionsPerCycle={targetSessionsPerCycle}
          updateSetting={updateSetting}
        />
        <SoundFeedbackPanel
          soundEnabled={soundEnabled}
          tactileEnabled={tactileEnabled}
          developerFont={developerFont}
          updateSetting={updateSetting}
        />
        <AlgorithmPanel initialEasinessFactor={initialEasinessFactor} updateSetting={updateSetting} />
        <ZenLockoutPanel
          enforceLockout={enforceLockout}
          autoArchiveAncientTasks={autoArchiveAncientTasks}
          updateSetting={updateSetting}
        />
      </div>

      <div className="flex flex-col gap-6">
        <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-6 shadow-2xl backdrop-blur-3xl flex flex-col">
          <h3 className="text-xs font-bold text-white/50 tracking-wider uppercase mb-4">Subject Categories</h3>
          <div className="flex gap-2 mb-4 bg-white/5 border border-white/5 p-2 rounded-full">
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              type="text"
              placeholder="Label (e.g. Science)"
              className="flex-1 rounded-full bg-transparent px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = newCategoryName.trim()
                  if (!val) return
                  addCategory(val, newCategoryColor)
                  setNewCategoryName('')
                }
              }}
            />
            <input
              type="color"
              value={newCategoryColor}
              onChange={e => setNewCategoryColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-full border border-white/10 bg-[#0c0f17] p-0.5"
            />
            <button
              onClick={() => {
                const val = newCategoryName.trim()
                if (!val) return
                addCategory(val, newCategoryColor)
                setNewCategoryName('')
              }}
              className="rounded-full bg-accent-blue hover:bg-accent-blue/90 text-white px-4 py-1.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
            >
              Add
            </button>
          </div>
          <div className="flex items-center gap-2.5 mb-4.5 px-2 select-none">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Swatches:</span>
            <div className="flex flex-wrap gap-2">
              {['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#64748B'].map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewCategoryColor(color)}
                  className={`h-5.5 w-5.5 rounded-full border cursor-pointer transition-all duration-200 hover:scale-110 ${
                    newCategoryColor.toLowerCase() === color.toLowerCase()
                      ? 'border-white scale-105 shadow-md shadow-white/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
            {categories.length === 0 ? (
              <p className="text-xs italic text-white/30 text-center py-4">No categories configured yet.</p>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2.5 rounded-[16px] bg-black/20 border border-white/5 px-3.5 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full border border-white/5" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-xs font-bold text-white/80 truncate">{cat.name}</span>
                  <button
                    onClick={async () => {
                      try {
                        await deleteCategory(cat.id!)
                      } catch {
                        alert('Cannot delete the last category.')
                      }
                    }}
                    aria-label={`Delete category ${cat.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all ios-active-scale cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <BackupVaultPanel
          exportStudyBackup={exportStudyBackup}
          exportStudyLogsCSV={exportStudyLogsCSV}
          exportTaskCompletionLogsCSV={exportTaskCompletionLogsCSV}
          importStudyBackup={importStudyBackup}
          resetData={resetData}
          resetDataSelective={resetDataSelective}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          handleFileDrop={handleFileDrop}
          fileInputRef={fileInputRef}
        />
      </div>
    </div>
  )
}
