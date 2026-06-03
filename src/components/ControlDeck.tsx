import React from 'react'
import { X } from 'lucide-react'
import type { CategoryItem, SettingsKey, SettingsValue } from '../db/types'

interface ControlDeckProps {
  updateSetting: (key: SettingsKey, val: SettingsValue) => void
  theme: string
  cardOpacity: number
  backdropBlur: number
  soundEnabled: boolean
  tactileEnabled: boolean
  localEnforceLockout: boolean
  setLocalEnforceLockout: (val: boolean) => void
  audio_presets: any[]
  localVolumeRain: number
  setLocalVolumeRain: (val: number) => void
  localVolumeCafe: number
  setLocalVolumeCafe: (val: number) => void
  localVolumeWhiteNoise: number
  setLocalVolumeWhiteNoise: (val: number) => void
  localAlphaWaves: number
  setLocalAlphaWaves: (val: number) => void
  exportStudyBackup: () => void
  exportStudyLogsCSV: () => void
  importStudyBackup: (val: string) => void
  resetData: () => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: number) => void
  newCategoryName: string
  setNewCategoryName: (val: string) => void
  newCategoryColor: string
  setNewCategoryColor: (val: string) => void
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
  localEnforceLockout,
  setLocalEnforceLockout,
  exportStudyBackup,
  exportStudyLogsCSV,
  importStudyBackup,
  resetData,
  categories,
  addCategory,
  deleteCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryColor,
  setNewCategoryColor,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Left settings column */}
      <div className="flex flex-col gap-6">
        
        {/* Aesthetics & Translucency settings */}
        <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-6 shadow-2xl backdrop-blur-3xl">
          <h3 className="text-xs font-bold text-white/50 tracking-wider uppercase mb-5">Aesthetics & Translucency</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-white/80">Active Theme Preset</span>
              </div>
              <select
                value={theme}
                onChange={e => updateSetting('theme', e.target.value)}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white outline-none cursor-pointer hover:bg-white/10 transition-colors font-semibold"
              >
                <option value="midnight-slate" className="bg-[#11131e] text-white">Midnight Slate (Default)</option>
                <option value="midnight-oled" className="bg-[#11131e] text-white">Midnight OLED</option>
                <option value="nordic-frost" className="bg-[#11131e] text-white">Nordic Frost</option>
                <option value="amber-retro" className="bg-[#11131e] text-white">Amber Retro</option>
                <option value="nebula-purple" className="bg-[#11131e] text-white">Nebula Purple</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-white/80">Card Backdrop Opacity</span>
                <span className="text-xs font-bold text-white">{Math.round(cardOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.90"
                step="0.05"
                value={cardOpacity}
                onChange={e => updateSetting('cardOpacity', parseFloat(e.target.value))}
                className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-white/5 outline-none"
              />
              <div className="mt-1.5 flex justify-between text-[9px] text-white/40 font-semibold uppercase">
                <span>Max Translucency</span>
                <span>Solid background</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-white/80">Frosting blur size</span>
                <span className="text-xs font-bold text-accent-blue">{backdropBlur}px</span>
              </div>
              <input
                type="range"
                min="4"
                max="24"
                step="1"
                value={backdropBlur}
                onChange={e => updateSetting('backdropBlur', parseInt(e.target.value))}
                className="w-full accent-accent-blue h-1.5 rounded-full cursor-pointer bg-white/5 outline-none"
              />
              <div className="mt-1.5 flex justify-between text-[9px] text-white/40 font-semibold uppercase">
                <span>Sharp layout</span>
                <span>Heavy blur</span>
              </div>
            </div>
          </div>
        </div>

        {/* Zen Lockout */}
        <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-6 shadow-2xl backdrop-blur-3xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-white/50 tracking-wider uppercase mb-2">Zen Lockout</h3>
            <p className="text-[10px] text-white/40 leading-relaxed">Hides tab and escape navigation menus during study blocks to enforce strict focus.</p>
          </div>
          <div className="flex items-center justify-between mt-4 bg-black/20 border border-white/5 px-4 py-3 rounded-2xl">
            <span className="text-[10px] font-semibold text-white/70">{localEnforceLockout ? 'Enforced' : 'Bypassed'}</span>
            <button
              onClick={() => {
                const nextVal = !localEnforceLockout
                setLocalEnforceLockout(nextVal)
                updateSetting('enforce_lockout', nextVal)
              }}
              className={`ios-switch shrink-0 ${localEnforceLockout ? 'active' : ''}`}
            >
              <span className="ios-switch-thumb" />
            </button>
          </div>
        </div>
      </div>

      {/* Right settings column */}
      <div className="flex flex-col gap-6">
        
        {/* Subject category customizer */}
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

          <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
            {categories.length === 0 ? (
              <p className="text-xs italic text-white/30 text-center py-4">No categories configured yet.</p>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2.5 rounded-[16px] bg-black/20 border border-white/5 px-3.5 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full border border-white/5" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-xs font-bold text-white/80 truncate">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat.id!)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all ios-active-scale cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Backups & resets */}
        <div className="border border-white/5 bg-white/[0.02] rounded-[28px] p-6 shadow-2xl backdrop-blur-3xl">
          <h3 className="text-xs font-bold text-white/50 tracking-wider uppercase mb-3">Backup Vault</h3>
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
                isDragging
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-white/10 bg-black/20 hover:border-white/20'
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
            <p className="text-xs text-red-300/50 leading-normal mb-4">Clearing parameters sweeps databases completely.</p>
            <button
              onClick={() => {
                if (confirm("DANGER: Sweeping tables deletes your stats permanently. Reset?")) {
                  resetData()
                }
              }}
              className="rounded-full bg-red-500/10 border border-red-500/20 px-4.5 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all ios-active-scale cursor-pointer"
            >
              Clear & Reset Workspace Data
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
