import React from 'react'
import { X } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'

interface HotkeyModalProps {
  isOpen: boolean
  onClose: () => void
}

import { FOCUS_MODE } from '../lib/uxTerms'

const SHORTCUTS = [
  { keys: 'Space', action: 'Toggle play / pause' },
  { keys: 'S', action: 'Switch to study mode' },
  { keys: 'B', action: 'Switch to break mode' },
  { keys: 'C / Shift+C', action: 'Complete study block (Shift+C ends early)' },
  { keys: 'Z', action: `Toggle ${FOCUS_MODE.toLowerCase()}` },
  { keys: '1–5', action: 'Jump to Focus, Cards, Analytics, Journal, Settings' },
  { keys: '?', action: 'Toggle this shortcut panel' },
  { keys: '[', action: 'Toggle sidebar collapse (desktop)' },
]

const FLASHCARD_SHORTCUTS = [
  { keys: 'Space', action: 'Flip card' },
  { keys: '1 / 2 / 4 / 5', action: 'Grade recall (when answer is visible)' },
  { keys: 'Escape', action: 'End study session (with confirm)' },
]

export const HotkeyModal: React.FC<HotkeyModalProps> = ({ isOpen, onClose }) => (
  <ModalShell
    open={isOpen}
    onClose={onClose}
    ariaLabelledby="hotkey-modal-title"
    ariaDescribedby="hotkey-modal-desc"
    panelClassName="max-w-sm bg-white/5 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)]"
  >
    <p id="hotkey-modal-desc" className="sr-only">Keyboard shortcuts for timer controls, focus mode, and this help panel.</p>
    <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
      <h3 id="hotkey-modal-title" className="text-lg font-semibold">Keyboard Shortcuts</h3>
      <button
        type="button"
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
          <kbd className="rounded border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-label font-bold uppercase text-white">{item.keys}</kbd>
        </div>
      ))}
    </div>
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-label font-bold uppercase tracking-wider text-slate-400 mb-3">During flashcard study</p>
      <div className="space-y-2">
        {FLASHCARD_SHORTCUTS.map(item => (
          <div key={item.keys} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
            <span className="text-xs text-white/70">{item.action}</span>
            <kbd className="rounded border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{item.keys}</kbd>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-500">Flashcard shortcuts apply only while the study modal is open.</p>
    </div>
    <p className="mt-4 text-center text-label text-slate-400">Shortcuts are disabled while typing in input fields.</p>
    <p className="mt-2 text-center text-label text-slate-500">
      Timer shortcuts still work on Settings while a study block is active. Tab through navigation to reach every section without a mouse.
    </p>
  </ModalShell>
)
