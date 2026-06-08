export function TabLoadingFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-white/50 text-sm animate-fade-in">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <p>Loading {label}…</p>
    </div>
  )
}
