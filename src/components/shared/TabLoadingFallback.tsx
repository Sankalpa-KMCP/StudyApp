import { PanelCard } from './PanelCard'

export function TabLoadingFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-1 items-start min-h-0 animate-fade-in"
    >
      <PanelCard className="lg:col-span-5 flex flex-col gap-4">
        <div className="h-4 w-32 rounded-full bg-white/10 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
      </PanelCard>
      <PanelCard className="lg:col-span-7 flex flex-col gap-4">
        <div className="h-4 w-40 rounded-full bg-white/10 animate-pulse" />
        <div className="h-52 rounded-2xl bg-white/5 animate-pulse" />
        <p className="text-caption text-white/40 text-center">Loading {label}…</p>
      </PanelCard>
    </div>
  )
}
