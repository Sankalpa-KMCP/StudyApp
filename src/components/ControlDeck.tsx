import React from 'react'
import { Check, Trash2, X } from 'lucide-react'
import type { CategoryItem } from '../db/types'

interface ControlDeckProps {
  theme: string
  updateSetting: (key: any, val: any) => void
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
  importStudyBackup: (val: string) => void
  resetData: () => void
  categories: CategoryItem[]
  addCategory: (name: string, color: string) => void
  deleteCategory: (id: number) => void
  newCategoryName: string
  setNewCategoryName: (val: string) => void
  newCategoryColor: string
  setNewCategoryColor: (val: string) => void
  localDeveloperFont: string
  setLocalDeveloperFont: (val: string) => void
  isDragging: boolean
  setIsDragging: (val: boolean) => void
  handleFileDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  THEME_PROFILES: any
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  theme,
  updateSetting,
  cardOpacity,
  backdropBlur,
  soundEnabled,
  tactileEnabled,
  localEnforceLockout,
  setLocalEnforceLockout,
  audio_presets,
  localVolumeRain,
  setLocalVolumeRain,
  localVolumeCafe,
  setLocalVolumeCafe,
  localVolumeWhiteNoise,
  setLocalVolumeWhiteNoise,
  localAlphaWaves,
  setLocalAlphaWaves,
  exportStudyBackup,
  importStudyBackup,
  resetData,
  categories,
  addCategory,
  deleteCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryColor,
  setNewCategoryColor,
  localDeveloperFont,
  setLocalDeveloperFont,
  isDragging,
  setIsDragging,
  handleFileDrop,
  fileInputRef,
  THEME_PROFILES
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full flex-1 items-start animate-fade-in">
      
      {/* Left settings pane - Grid 8 */}
      <div className="xl:col-span-8 flex flex-col gap-6">
         {/* Visual Themes profile */}
        <div className="border border-white/[0.06] dynamic-card p-6">
          <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-4">Workspace Theme Profiles</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(THEME_PROFILES).map(([key, profile]: any) => {
              const isSelected = theme === key
              const displayName = key.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              return (
                <button
                  key={key}
                  onClick={() => updateSetting('theme', key)}
                  className={`relative flex flex-col text-left p-4 rounded-xl border transition-all duration-300 ease-out cursor-pointer group ${
                    isSelected
                      ? 'border-white/20 bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 w-full">
                    <span className="text-xs font-bold text-white/90">{displayName}</span>
                    {isSelected && (
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-white text-slate-950 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-white/40">
                    <span className="h-4.5 w-4.5 rounded-full border border-white/5" style={{ backgroundColor: profile.surface }} title="Background" />
                    <span className="h-4.5 w-4.5 rounded-full border border-white/5" style={{ backgroundColor: profile.surfaceCard }} title="Cards" />
                    <div className="h-4 w-px bg-white/10" />
                    <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentBlue }} title="Primary" />
                    <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentPurple }} title="Secondary" />
                    <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentGreen }} title="Cycle break" />
                    <span className="h-4.5 w-4.5 rounded-full" style={{ backgroundColor: profile.accentAmber }} title="Intermission" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>               

        {/* Translucency sliders */}
        <div className="border border-white/[0.06] dynamic-card p-6">
          <h3 className="text-xs font-semibold text-white/80 tracking-wider uppercase mb-5">Translucency & Backdrop Blur Frosting</h3>
          <div className="space-y-6">
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
              <div className="mt-1 flex justify-between text-[9px] text-slate-500 font-semibold uppercase">
                <span>Max Translucency</span>
                <span>Solid background</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-350">Frosting blur size</span>
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
              <div className="mt-1 flex justify-between text-[9px] text-slate-500 font-semibold uppercase">
                <span>Sharp layout</span>
                <span>Heavy blur</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calibration controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sound completions */}
          <div className="rounded-2xl border border-white/5 dynamic-card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-2">Bowl Chime</h3>
              <p className="text-[10px] text-slate-505 leading-relaxed">Play Singing Bowl chime when focus intervals complete.</p>
            </div>
            <div className="flex items-center justify-between mt-4 bg-[#0c0f17]/40 border border-white/5 px-3 py-2 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-350">{soundEnabled ? 'Active' : 'Muted'}</span>
              <button
                onClick={() => updateSetting('soundEnabled', !soundEnabled)}
                className={`relative h-5.5 w-10 shrink-0 rounded-full transition-all cursor-pointer ${soundEnabled ? 'bg-accent-blue' : 'bg-white/5 border border-white/5'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Tactile keystrokes */}
          <div className="rounded-2xl border border-white/5 dynamic-card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-2">Tactile Feedback</h3>
              <p className="text-[10px] text-slate-505 leading-relaxed">Synthesizes a mechanical key "thock" sound on interactions.</p>
            </div>
            <div className="flex items-center justify-between mt-4 bg-[#0c0f17]/40 border border-white/5 px-3 py-2 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-350">{tactileEnabled ? 'Enabled' : 'Muted'}</span>
              <button
                onClick={() => updateSetting('tactile_feedback', !tactileEnabled)}
                className={`relative h-5.5 w-10 shrink-0 rounded-full transition-all cursor-pointer ${tactileEnabled ? 'bg-accent-blue' : 'bg-white/5 border border-white/5'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform ${tactileEnabled ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Lockout mode */}
          <div className="rounded-2xl border border-white/5 dynamic-card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-2">Zen Lockout</h3>
              <p className="text-[10px] text-slate-505 leading-relaxed">Hides tab and escape navigation menus during study blocks.</p>
            </div>
            <div className="flex items-center justify-between mt-4 bg-[#0c0f17]/40 border border-white/5 px-3 py-2 rounded-xl">
              <span className="text-[10px] font-semibold text-slate-350">{localEnforceLockout ? 'Enforced' : 'Bypassed'}</span>
              <button
                onClick={() => {
                  const nextVal = !localEnforceLockout
                  setLocalEnforceLockout(nextVal)
                  updateSetting('enforce_lockout', nextVal)
                }}
                className={`relative h-5.5 w-10 shrink-0 rounded-full transition-all cursor-pointer ${localEnforceLockout ? 'bg-accent-purple animate-pulse-soft' : 'bg-white/5 border border-white/5'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-4.5 w-4.5 rounded-full bg-white transition-transform ${localEnforceLockout ? 'translate-x-4.5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Environment preset creator */}
        <div className="rounded-2xl border border-white/5 dynamic-card p-6">
          <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase mb-4">Environment Sound Presets</h3>
          <div className="space-y-4 mb-4 pb-4 border-b border-white/5">
            <p className="text-xs text-slate-550">Save your active environmental audio track volume mixes as a dynamic profile preset.</p>
            <div className="flex gap-2">
              <input
                id="preset-name-input"
                type="text"
                placeholder="Preset Label (e.g. Rainy Cafe Study)"
                className="flex-1 rounded-xl border border-white/5 bg-[#0c0f17]/40 focus:bg-black/20 focus:border-accent-blue/40 px-3.5 py-2 text-xs text-text-primary outline-none transition-all"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value?.trim()
                    if (!val) return
                    const newPreset = {
                      id: Date.now(),
                      name: val,
                      volumes: { rain: localVolumeRain, cafe: localVolumeCafe, whiteNoise: localVolumeWhiteNoise, alphaWaves: localAlphaWaves }
                    }
                    updateSetting('audio_presets', [...audio_presets, newPreset])
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
              />
              <button
                onClick={() => {
                  const el = document.getElementById('preset-name-input') as HTMLInputElement
                  const val = el?.value?.trim()
                  if (!val) return
                  const newPreset = {
                    id: Date.now(),
                    name: val,
                    volumes: { rain: localVolumeRain, cafe: localVolumeCafe, whiteNoise: localVolumeWhiteNoise, alphaWaves: localAlphaWaves }
                  }
                  updateSetting('audio_presets', [...audio_presets, newPreset])
                  if (el) el.value = ''
                }}
                className="rounded-xl bg-accent-blue text-slate-950 border border-accent-blue px-4 py-2 text-xs font-bold hover:bg-accent-blue/90 transition-all cursor-pointer"
              >
                Save Preset
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Presets</p>
            {audio_presets.length === 0 ? (
              <p className="text-xs italic text-slate-500 py-2">No custom environmental presets created yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {audio_presets.map((preset: any) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between rounded-xl bg-[#0c0f17]/40 border border-white/5 p-3 hover:border-white/10 group transition-all"
                  >
                    <div
                      className="flex-1 cursor-pointer min-w-0"
                      onClick={() => {
                        const vols = preset.volumes || {}
                        if (vols.rain !== undefined) { setLocalVolumeRain(vols.rain); updateSetting('ambientVolume_rain', vols.rain) }
                        if (vols.cafe !== undefined) { setLocalVolumeCafe(vols.cafe); updateSetting('ambientVolume_cafe', vols.cafe) }
                        if (vols.whiteNoise !== undefined) { setLocalVolumeWhiteNoise(vols.whiteNoise); updateSetting('ambientVolume_whiteNoise', vols.whiteNoise) }
                        if (vols.alphaWaves !== undefined) { setLocalAlphaWaves(vols.alphaWaves); updateSetting('ambient_alphaWaves', vols.alphaWaves) }
                      }}
                    >
                      <p className="text-xs font-bold text-slate-200 truncate">{preset.name}</p>
                      <p className="text-[9px] text-slate-500 mt-1 font-mono font-bold">
                        🌧️ {Math.round((preset.volumes?.rain ?? 0) * 100)}% · 
                        ☕ {Math.round((preset.volumes?.cafe ?? 0) * 100)}% · 
                        📻 {Math.round((preset.volumes?.whiteNoise ?? 0) * 100)}%
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const filtered = audio_presets.filter((p: any) => p.id !== preset.id)
                        updateSetting('audio_presets', filtered)
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Backups & resets */}
        <div className="rounded-2xl border border-white/5 dynamic-card p-6">
          <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-3">Backup Vault container</h3>
          <p className="text-xs text-slate-505 mb-5 leading-relaxed">
            Export backup data bundle to sync tables or local study logs across devices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/5 bg-[#0c0f17]/40 p-4 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300 block">Export backup vault</span>
                <span className="text-[10px] text-slate-500 mt-1 leading-normal font-semibold">Prepares a JSON study logs package and initiates browser download.</span>
              </div>
              <button
                onClick={exportStudyBackup}
                className="w-full mt-4 rounded-xl bg-accent-blue text-slate-950 border border-accent-blue py-2 text-xs font-bold hover:bg-accent-blue/90 transition-all cursor-pointer"
              >
                Export Vault
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer min-h-[120px] ${
                isDragging
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-white/5 bg-[#0c0f17]/40 hover:border-white/10'
              }`}
            >
              <span className="text-2xl mb-1.5">📥</span>
              <span className="text-xs font-bold text-slate-300">Drag backup here</span>
              <span className="text-[9px] text-slate-550 mt-0.5">or browse files to restore</span>
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
            <p className="text-xs text-red-300/60 leading-normal mb-4">Clearing parameters sweeps databases and settings completely. Resetting restores setup values.</p>
            <button
              onClick={() => {
                if (confirm("DANGER: Sweeping tables deletes your stats permanently. Reset?")) {
                  resetData()
                }
              }}
              className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Clear & Reset Workspace Data
            </button>
          </div>
        </div>
      </div>

      {/* Right settings column - Grid 4 */}
      <div className="xl:col-span-4 flex flex-col gap-6">
        
        {/* Subject category customizer */}
        <div className="rounded-2xl border border-white/5 dynamic-card p-6 flex flex-col">
          <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-4">Subject Categories</h3>
          
          <div className="flex gap-2 mb-4 bg-white/[0.01] border border-white/5 p-2 rounded-xl">
            <input
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              type="text"
              placeholder="Label (e.g. Science)"
              className="flex-1 rounded-xl bg-black/20 px-3 py-1.5 text-xs text-text-primary placeholder:text-slate-550 outline-none transition-all"
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
              className="h-8 w-8 cursor-pointer rounded-xl border border-white/5 bg-[#0c0f17] p-0.5"
            />
            <button
              onClick={() => {
                const val = newCategoryName.trim()
                if (!val) return
                addCategory(val, newCategoryColor)
                setNewCategoryName('')
              }}
              className="rounded-xl bg-accent-blue/15 border border-accent-blue/20 text-accent-blue px-3 py-1.5 text-xs font-bold hover:bg-accent-blue/20 transition-all cursor-pointer"
            >
              Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[260px] custom-scrollbar space-y-2 pr-1">
            {categories.length === 0 ? (
              <p className="text-xs italic text-slate-500 text-center py-4">No categories configured yet.</p>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2.5 rounded-xl bg-[#0c0f17]/40 border border-white/5 px-3 py-2">
                  <span className="h-3 w-3 shrink-0 rounded-full border border-white/5" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-xs font-bold text-slate-350 truncate">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat.id!)}
                    className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Font Calibration tab */}
        <div className="rounded-2xl border border-white/5 dynamic-card p-6">
          <h3 className="text-xs font-bold text-slate-350 tracking-wider uppercase mb-4">Typography Overrides</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Primary font override</label>
              <select
                value={localDeveloperFont}
                onChange={e => {
                  const val = e.target.value
                  setLocalDeveloperFont(val)
                  updateSetting('developer_font', val)
                }}
                className="w-full rounded-xl border border-white/5 bg-[#0c0f17] px-3.5 py-2.5 text-xs text-text-primary outline-none focus:border-accent-blue/40 cursor-pointer"
              >
                <option value="Outfit">Outfit (Geometric display)</option>
                <option value="Inter">Inter (Sans-serif display)</option>
                <option value="JetBrains Mono">JetBrains Mono (Console default)</option>
                <option value="Fira Code">Fira Code (Ligature style)</option>
                <option value="SF Mono">SF Mono (System default)</option>
              </select>
              <p className="mt-2 text-[10px] text-slate-550 font-semibold leading-normal">
                Custom font changes map instantly. Useful for aligning study dashboards with developer workspaces.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
