import type { ToastState } from '../../types/app'

interface AppToastOverlayProps {
  toast: ToastState | null
}

export function AppToastOverlay({ toast }: AppToastOverlayProps) {
  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 surface-track backdrop-blur-xl border border-card shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-label font-mono tracking-wider text-primary animate-slide-down"
    >
      <kbd className="surface-track text-primary border border-card rounded px-1.5 py-0.5 text-label font-sans">{toast.key}</kbd>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="ml-1 rounded-full surface-track px-2.5 py-0.5 text-label font-bold text-primary hover:opacity-90 ios-active-scale"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
