import { Brain } from 'lucide-react'

interface AppShellLoadingScreenProps {
  pageGradient: string
}

export function AppShellLoadingScreen({ pageGradient }: AppShellLoadingScreenProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center"
      style={{ background: pageGradient }}
    >
      <div className="dynamic-card-static flex flex-col items-center gap-5 px-8 py-7 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-tr from-accent-blue to-accent-purple shadow-md shadow-accent-blue/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-card border-t-primary" />
          <p className="text-sm text-secondary font-semibold tracking-wide">Loading Study Dashboard</p>
          <p className="text-caption text-muted">Preparing your local sanctuary...</p>
        </div>
      </div>
    </div>
  )
}
