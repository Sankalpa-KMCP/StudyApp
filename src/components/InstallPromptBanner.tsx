import { Sparkles, X } from 'lucide-react'

interface InstallPromptBannerProps {
  onInstall: () => void
  onDismiss: () => void
}

export function InstallPromptBanner({ onInstall, onDismiss }: InstallPromptBannerProps) {
  return (
    <div
      role="region"
      aria-label="Install app"
      className="flex items-center justify-between gap-3 border-b border-accent-blue/20 bg-accent-blue/10 px-4 py-2.5"
    >
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="h-4 w-4 shrink-0 text-accent-blue" aria-hidden />
        <p className="text-label font-semibold text-primary truncate">Install Study Dashboard for quick access</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onInstall}
          className="rounded-full bg-accent-blue px-3 py-1 text-label font-bold text-on-accent ios-active-scale"
        >
          Install
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss install prompt"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-primary hover:surface-track ios-active-scale"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
