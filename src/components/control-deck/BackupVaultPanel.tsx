import React, { useState } from 'react'
import { SettingsCard } from '../shared/settings/SettingsCard'

interface BackupVaultPanelProps {
  exportStudyBackup: () => void
  exportStudyLogsCSV: () => void
  exportTaskCompletionLogsCSV: () => void
  importStudyBackup: (val: string) => void
  resetData: () => void
  resetDataSelective: (options: { tasks: boolean; history: boolean; categories: boolean; cards: boolean; notes: boolean }) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  handleFileDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function BackupVaultPanel({
  exportStudyBackup,
  exportStudyLogsCSV,
  exportTaskCompletionLogsCSV,
  importStudyBackup,
  resetData,
  resetDataSelective,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef,
}: BackupVaultPanelProps) {
  const [sweepTasks, setSweepTasks] = useState(false)
  const [sweepHistory, setSweepHistory] = useState(false)
  const [sweepCategories, setSweepCategories] = useState(false)
  const [sweepCards, setSweepCards] = useState(false)
  const [sweepNotes, setSweepNotes] = useState(false)

  return (
    <SettingsCard title="Backup Vault">
      <p className="text-xs text-white/50 mb-5 leading-relaxed">
        Export backup data bundle to sync tables or local study logs across devices.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-white/95 block">Export backup vault</span>
            <span className="text-[10px] text-white/40 mt-1 leading-normal font-semibold">Prepares a JSON package and initiates browser download.</span>
          </div>
          <button
            onClick={exportStudyBackup}
            className="w-full mt-4 rounded-full bg-accent-blue text-white py-2.5 text-xs font-bold hover:bg-accent-blue/90 transition-all ios-active-scale cursor-pointer shadow-md shadow-accent-blue/15"
          >
            Export Vault
          </button>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center border border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer min-h-[120px] ${
            isDragging ? 'border-accent-purple bg-accent-purple/10' : 'border-white/10 bg-black/20 hover:border-white/20'
          }`}
        >
          <span className="text-2xl mb-1.5">📥</span>
          <span className="text-xs font-bold text-white/90">Drag backup here</span>
          <span className="text-[9px] text-white/40 mt-0.5">or browse files to restore</span>
        </div>
      </div>

      <div className="mt-5 border-t border-white/5 pt-5">
        <span className="text-xs font-bold text-white/90 block mb-3">CSV Reports Export</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-white/95 block">Study Logs (CSV)</span>
              <span className="text-[10px] text-white/40 mt-1 leading-normal font-semibold">Export daily study and break durations, mood, and reflection notes.</span>
            </div>
            <button
              onClick={exportStudyLogsCSV}
              className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
            >
              Export CSV Logs
            </button>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/20 p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-white/95 block">Task Completion (CSV)</span>
              <span className="text-[10px] text-white/40 mt-1 leading-normal font-semibold">Export tasks registry data, completion status, estimates, and subtask progress.</span>
            </div>
            <button
              onClick={exportTaskCompletionLogsCSV}
              className="w-full mt-4 rounded-full bg-accent-blue/10 hover:bg-accent-blue/25 text-accent-blue border border-accent-blue/20 py-2.5 text-xs font-bold transition-all ios-active-scale cursor-pointer"
            >
              Export CSV Tasks
            </button>
          </div>
        </div>
      </div>

      <input
        type="file"
        accept=".studybackup,.json"
        ref={fileInputRef}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) {
            const r = new FileReader()
            r.onload = () => importStudyBackup(r.result as string)
            r.readAsText(file)
          }
          e.target.value = ''
        }}
      />

      <div className="mt-6 border-t border-red-500/15 pt-5">
        <span className="text-xs font-bold text-red-400 block mb-1">Destructive reset zone</span>
        <p className="text-[10px] text-white/50 leading-normal mb-4">
          Select specific database tables to clear individually, or sweep all tables to perform a full workspace wipe.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5 bg-black/10 border border-white/5 p-4 rounded-2xl">
          {[
            { label: 'Tasks & Subtasks', checked: sweepTasks, set: setSweepTasks },
            { label: 'Study Logs & History', checked: sweepHistory, set: setSweepHistory },
            { label: 'Subject Categories', checked: sweepCategories, set: setSweepCategories },
            { label: 'Flashcard Decks', checked: sweepCards, set: setSweepCards },
            { label: 'Quick Notes', checked: sweepNotes, set: setSweepNotes },
          ].map(item => (
            <label key={item.label} className="flex items-center gap-2.5 text-[10px] text-white/70 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => item.set(e.target.checked)}
                className="rounded border-white/10 bg-black/30 text-red-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={!sweepTasks && !sweepHistory && !sweepCategories && !sweepCards && !sweepNotes}
            onClick={() => {
              if (confirm('Are you sure you want to sweep the selected workspace databases? This cannot be undone.')) {
                resetDataSelective({
                  tasks: sweepTasks,
                  history: sweepHistory,
                  categories: sweepCategories,
                  cards: sweepCards,
                  notes: sweepNotes,
                })
                setSweepTasks(false)
                setSweepHistory(false)
                setSweepCategories(false)
                setSweepCards(false)
                setSweepNotes(false)
              }
            }}
            className="rounded-full bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:pointer-events-none transition-all ios-active-scale cursor-pointer"
          >
            Sweep Selected
          </button>
          <button
            onClick={() => {
              if (confirm('DANGER: Sweeping all tables deletes your workspace stats and configuration permanently. Reset everything?')) {
                resetData()
              }
            }}
            className="rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10 transition-all ios-active-scale cursor-pointer"
          >
            Sweep All Tables
          </button>
        </div>
      </div>
    </SettingsCard>
  )
}
