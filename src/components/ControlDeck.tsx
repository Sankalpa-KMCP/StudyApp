import React, { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import type { CategoryItem, SettingsKey, SettingsValue } from '../db/types'
import { AestheticsPanel } from './control-deck/AestheticsPanel'
import { TimerFocusPanel } from './control-deck/TimerFocusPanel'
import { SoundFeedbackPanel } from './control-deck/SoundFeedbackPanel'
import { AlgorithmPanel } from './control-deck/AlgorithmPanel'
import { ZenLockoutPanel } from './control-deck/ZenLockoutPanel'
import { BackupVaultPanel } from './control-deck/BackupVaultPanel'
import { TabPageShell } from './shared/TabPageShell'
import { SettingsCard } from './shared/settings/SettingsCard'

interface ControlDeckProps {
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
  updateCategory: (id: number, updates: { dailyGoalMinutes?: number }) => void | Promise<void>
  theme: string
  themePreset: string
  cardOpacity: number
  backdropBlur: number
  initialEasinessFactor: number
  dailyGoalMinutes: number
  studyBlockDurationMinutes: number
  shortBreakDurationMinutes: number
  longBreakDurationMinutes: number
  targetSessionsPerCycle: number
  recentHistoryLimit: number
  focusNotificationsEnabled: boolean
  soundEnabled: boolean
  tactileEnabled: boolean
  developerFont: string
  enforceLockout: boolean
  autoArchiveAncientTasks: boolean
  autoPauseOnHidden: boolean
  exportStudyBackup: () => void
  isExporting?: boolean
  exportProgress?: number
  exportStudyLogsCSV: () => void
  exportTaskCompletionLogsCSV: () => void
  importStudyBackup: (val: string) => void
  resetData: () => void
  resetDataSelective: (options: { tasks: boolean; history: boolean; categories: boolean; cards: boolean; notes: boolean }) => void
  clearSnapshots: () => void
  quotaExceeded?: boolean
  categories: CategoryItem[]
  addCategory: (name: string, color: string, dailyGoalMinutes?: number) => void | Promise<number>
  deleteCategory: (id: number) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  handleFileDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onShowOnboarding?: () => void
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  updateSetting,
  updateCategory,
  theme,
  themePreset,
  cardOpacity,
  backdropBlur,
  initialEasinessFactor,
  dailyGoalMinutes,
  studyBlockDurationMinutes,
  shortBreakDurationMinutes,
  longBreakDurationMinutes,
  targetSessionsPerCycle,
  recentHistoryLimit,
  focusNotificationsEnabled,
  soundEnabled,
  tactileEnabled,
  developerFont,
  enforceLockout,
  autoArchiveAncientTasks,
  autoPauseOnHidden,
  exportStudyBackup,
  isExporting,
  exportProgress,
  exportStudyLogsCSV,
  exportTaskCompletionLogsCSV,
  importStudyBackup,
  resetData,
  resetDataSelective,
  clearSnapshots,
  quotaExceeded = false,
  categories,
  addCategory,
  deleteCategory,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef,
  onShowOnboarding,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6')
  const [newCategoryGoal, setNewCategoryGoal] = useState('')
  const [startHereDismissed, setStartHereDismissed] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem('settings_start_here_dismissed'),
  )

  const scrollToSettingsSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dismissStartHere = () => {
    localStorage.setItem('settings_start_here_dismissed', 'true')
    setStartHereDismissed(true)
  }

  return (
    <TabPageShell>
      {!startHereDismissed && (
        <div className="lg:col-span-12">
          <SettingsCard title="Start here">
            <p className="text-[11px] text-white/50 leading-relaxed mb-3">
              Three essentials to set up your sanctuary on day one.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => scrollToSettingsSection('settings-timer-focus')}
                className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Daily goal → Timer & Focus
              </button>
              <button
                type="button"
                onClick={() => scrollToSettingsSection('settings-categories')}
                className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Subject categories → organize your tasks
              </button>
              <button
                type="button"
                onClick={() => scrollToSettingsSection('settings-backup-vault')}
                className="text-left text-xs font-semibold text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Export backup → keep your data safe
              </button>
            </div>
            <button
              type="button"
              onClick={dismissStartHere}
              className="mt-4 text-[10px] font-semibold text-white/40 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </SettingsCard>
        </div>
      )}
      {onShowOnboarding && (
        <div className="lg:col-span-12">
          <SettingsCard title="Getting Started">
            <button
              type="button"
              onClick={onShowOnboarding}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-xs font-semibold text-white/80 hover:bg-white/[0.06] transition-all ios-active-scale"
            >
              <Sparkles className="h-4 w-4 text-accent-blue shrink-0" />
              <span>Replay the Getting Started tour</span>
            </button>
          </SettingsCard>
        </div>
      )}
      <div className="lg:col-span-6 flex flex-col gap-6">
        <AestheticsPanel theme={theme} themePreset={themePreset} cardOpacity={cardOpacity} backdropBlur={backdropBlur} updateSetting={updateSetting} />
        <TimerFocusPanel
          dailyGoalMinutes={dailyGoalMinutes}
          studyBlockDurationMinutes={studyBlockDurationMinutes}
          shortBreakDurationMinutes={shortBreakDurationMinutes}
          longBreakDurationMinutes={longBreakDurationMinutes}
          targetSessionsPerCycle={targetSessionsPerCycle}
          recentHistoryLimit={recentHistoryLimit}
          focusNotificationsEnabled={focusNotificationsEnabled}
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
          autoPauseOnHidden={autoPauseOnHidden}
          updateSetting={updateSetting}
        />
      </div>

      <div className="lg:col-span-6 flex flex-col gap-6">
        <SettingsCard id="settings-categories" title="Subject Categories">
          <div className="flex gap-2 mb-4 bg-white/5 border border-white/5 p-2 rounded-full">
            <input
              id="category-name-input"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              type="text"
              placeholder="Label (e.g. Science)"
              aria-label="Category name"
              className="flex-1 rounded-full bg-transparent px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = newCategoryName.trim()
                  if (!val) return
                  const goal = newCategoryGoal.trim() ? Number(newCategoryGoal) : undefined
                  addCategory(val, newCategoryColor, goal)
                  setNewCategoryName('')
                  setNewCategoryGoal('')
                }
              }}
            />
            <input
              value={newCategoryGoal}
              onChange={e => setNewCategoryGoal(e.target.value)}
              type="number"
              min={15}
              max={960}
              step={15}
              placeholder="Goal (min)"
              aria-label="Category daily goal minutes"
              className="w-24 rounded-full bg-transparent px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none transition-all"
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
                const goal = newCategoryGoal.trim() ? Number(newCategoryGoal) : undefined
                addCategory(val, newCategoryColor, goal)
                setNewCategoryName('')
                setNewCategoryGoal('')
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
                  aria-label={`Category color ${color}`}
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
                  <input
                    type="number"
                    min={15}
                    max={960}
                    step={15}
                    aria-label={`Daily goal minutes for ${cat.name}`}
                    placeholder="Goal"
                    value={cat.dailyGoalMinutes ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      if (cat.id === undefined) return
                      void updateCategory(cat.id, {
                        dailyGoalMinutes: raw ? Number(raw) : undefined,
                      })
                    }}
                    className="w-16 rounded-lg bg-black/30 border border-white/10 px-2 py-1 text-[10px] text-white outline-none"
                  />
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
        </SettingsCard>

        <BackupVaultPanel
          exportStudyBackup={exportStudyBackup}
          isExporting={isExporting}
          exportProgress={exportProgress}
          exportStudyLogsCSV={exportStudyLogsCSV}
          exportTaskCompletionLogsCSV={exportTaskCompletionLogsCSV}
          importStudyBackup={importStudyBackup}
          resetData={resetData}
          resetDataSelective={resetDataSelective}
          clearSnapshots={clearSnapshots}
          quotaExceeded={quotaExceeded}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          handleFileDrop={handleFileDrop}
          fileInputRef={fileInputRef}
        />
      </div>
    </TabPageShell>
  )
}
