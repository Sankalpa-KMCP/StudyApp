import React from 'react'
import { X } from 'lucide-react'
import { ModalShell } from './shared/ModalShell'
import { useTranslation } from '../i18n/useTranslation'

interface HotkeyModalProps {
  isOpen: boolean
  onClose: () => void
}

export const HotkeyModal: React.FC<HotkeyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation()

  const shortcuts = [
    { keys: 'Ctrl+K', action: t('hotkeyCommandPalette') },
    { keys: 'Space', action: t('hotkeyTogglePlayPause') },
    { keys: 'S', action: t('hotkeySwitchStudy') },
    { keys: 'B', action: t('hotkeySwitchBreak') },
    { keys: 'C / Shift+C', action: t('hotkeyCompleteSession') },
    { keys: 'Z', action: t('hotkeyToggleFocusMode', { mode: t('focusMode').toLowerCase() }) },
    { keys: '1–4', action: t('hotkeyJumpTabs') },
    { keys: '?', action: t('hotkeyTogglePanel') },
    { keys: '[', action: t('hotkeyToggleSidebar') },
  ]

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      ariaLabelledby="hotkey-modal-title"
      ariaDescribedby="hotkey-modal-desc"
      panelClassName="max-w-sm surface-subtle p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4),_inset_0_1px_1px_rgba(255,255,255,0.08)]"
    >
      <p id="hotkey-modal-desc" className="sr-only">{t('hotkeyModalDesc')}</p>
      <div className="mb-5 flex items-center justify-between border-b border-card pb-3">
        <h3 id="hotkey-modal-title" className="text-lg font-semibold">{t('hotkeyModalTitle')}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('hotkeyCloseAria')}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-muted transition-colors hover:surface-track hover:text-primary cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {shortcuts.map(item => (
          <div key={item.keys} className="flex items-center justify-between rounded-xl border border-card surface-subtle px-4 py-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
            <span className="text-sm text-secondary">{item.action}</span>
            <kbd className="rounded border border-card surface-track px-2 py-0.5 font-mono text-label font-bold uppercase text-primary">{item.keys}</kbd>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-label text-muted">{t('hotkeyDisabledInInputs')}</p>
      <p className="mt-2 text-center text-label text-muted">{t('hotkeySettingsNote')}</p>
    </ModalShell>
  )
}
