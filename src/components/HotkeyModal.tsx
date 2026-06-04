import React from 'react'
import { X } from 'lucide-react'

interface HotkeyModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { keys: 'Space', action: 'Toggle play / pause' },
  { keys: 'S', action: 'Switch to Study mode' },
  { keys: 'B', action: 'Switch to Break mode' },
  { keys: 'C', action: 'Complete current session' },
  { keys: 'Z', action: 'Toggle Zen Sanctuary' },
  { keys: '?', action: 'Toggle this shortcut panel' },
]

export const HotkeyModal: React.FC<HotkeyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotkey-modal-title"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
          <h3 id="hotkey-modal-title" className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            aria-label="Close shortcuts panel"
            className="flex h-7 w-7 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          {SHORTCUTS.map(item => (
            <div key={item.keys} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
              <span className="text-sm text-white/80">{item.action}</span>
              <kbd className="rounded border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{item.keys}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-400">Shortcuts are disabled while typing in input fields.</p>
      </div>
    </div>
  )
}
