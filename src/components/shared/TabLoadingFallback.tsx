import { PanelCard } from './PanelCard'

interface TabLoadingFallbackProps {
  label: string
  variant?: 'default' | 'analytics'
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`rounded-full skeleton-pulse animate-pulse ${className}`} />
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-2xl skeleton-pulse-strong animate-pulse ${className}`} />
}

export function TabLoadingFallback({ label, variant = 'default' }: TabLoadingFallbackProps) {
  if (variant === 'analytics') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-live="polite"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start min-h-0 animate-fade-in"
      >
        <div className="lg:col-span-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <PanelCard key={i} className="flex flex-col gap-2 p-4">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-6 w-20" />
            </PanelCard>
          ))}
        </div>
        <PanelCard className="lg:col-span-7 flex flex-col gap-4">
          <SkeletonBar className="h-4 w-40" />
          <SkeletonBlock className="h-52" />
        </PanelCard>
        <PanelCard className="lg:col-span-5 flex flex-col gap-4">
          <SkeletonBar className="h-4 w-32" />
          <SkeletonBlock className="h-52" />
        </PanelCard>
        <p className="lg:col-span-12 text-caption text-muted text-center">Loading {label}…</p>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start min-h-0 animate-fade-in"
    >
      <PanelCard className="lg:col-span-5 flex flex-col gap-4">
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBlock className="h-40" />
        <SkeletonBar className="h-6 w-24" />
      </PanelCard>
      <PanelCard className="lg:col-span-7 flex flex-col gap-4">
        <SkeletonBar className="h-4 w-40" />
        <SkeletonBlock className="h-52" />
        <p className="text-caption text-muted text-center">Loading {label}…</p>
      </PanelCard>
    </div>
  )
}
