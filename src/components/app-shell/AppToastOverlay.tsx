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
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3),_inset_0_1px_1px_rgba(255,255,255,0.08)] rounded-full px-4 py-1.5 text-label font-mono tracking-wider text-white animate-slide-down"
    >
      <kbd className="bg-white/10 text-white border border-white/15 rounded px-1.5 py-0.5 text-label font-sans">{toast.key}</kbd>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="ml-1 rounded-full bg-white/15 px-2.5 py-0.5 text-label font-bold text-white hover:bg-white/25 ios-active-scale"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}
