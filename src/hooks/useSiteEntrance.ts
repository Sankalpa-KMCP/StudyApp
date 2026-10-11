import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { View } from '../navigation/viewRoutes'

const ENTRANCE_ANIMATIONS = new Set([
  'siteBrandSettle', 'siteNavigationSettle', 'heroLineSettle',
  'heroContentSettle', 'workspaceGroupSettle', 'workspaceHeadingSettle',
])

/** One decorative sequence per ready document, independent of saved preferences. */
export function useSiteEntrance(isLoading: boolean, view: View) {
  const [entry, setEntry] = useState<{ view: View; playing: boolean; ready: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Match the first ready render, so no animation expires behind the loading panel.
  if (!isLoading && entry === null) setEntry({ view, playing: true, ready: false })
  if (entry?.playing && entry.view !== view) setEntry({ ...entry, playing: false })
  const playing = entry?.playing === true && entry.view === view
  const preparing = playing && !entry.ready

  useLayoutEffect(() => {
    if (!playing) return
    let cancelled = false
    const finish = () => {
      if (!cancelled) setEntry(current => current ? { ...current, playing: false } : current)
    }
    const root = containerRef.current?.closest('.app-shell') ?? containerRef.current
    const animations = root?.getAnimations?.({ subtree: true })
      .filter(animation => ENTRANCE_ANIMATIONS.has((animation as CSSAnimation).animationName))
    if (animations?.length === 0) { finish(); return } // Reduced motion.
    if (preparing) {
      // CSS holds the initial keyframes during readiness/layout. Release after
      // a paint, so an expensive theme cannot consume the entrance offscreen.
      let frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (!cancelled) setEntry(current => current ? { ...current, ready: true } : current)
        })
      })
      const timer = window.setTimeout(finish, 10_000)
      return () => { cancelled = true; window.cancelAnimationFrame(frame); window.clearTimeout(timer) }
    }
    // Let native end events dispatch before removing their CSS animations.
    let frame = 0
    const settleAfterPaint = () => {
      if (cancelled) return
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(finish)
      })
    }
    const beganAt = performance.now()
    let times = animations?.map(animation => animation.currentTime)
    let timer: number
    const recover = () => {
      if (cancelled) return
      const nextTimes = animations?.map(animation => animation.currentTime)
      const progressing = animations?.some((animation, index) =>
        animation.playState === 'running' && typeof nextTimes?.[index] === 'number'
        && nextTimes[index] !== times?.[index],
      )
      times = nextTimes
      // Browser animation timelines can advance more slowly than wall time.
      // Allow progress, but bound stalled/missing signals and pathological runs.
      if ((progressing || animations?.some(animation => animation.pending)) && performance.now() - beganAt < 10_000) {
        timer = window.setTimeout(recover, Math.min(1600, 10_000 - (performance.now() - beganAt)))
      } else finish()
    }
    timer = window.setTimeout(recover, 1600)
    if (animations) void Promise.all(animations.map(animation => animation.finished.catch(() => undefined))).then(settleAfterPaint)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.cancelAnimationFrame(frame)
    }
  }, [playing, preparing])

  useEffect(() => {
    let frame = 0
    const cancelFrame = () => window.cancelAnimationFrame(frame)
    const hide = () => {
      cancelFrame()
      setEntry(current => current ? { ...current, playing: false } : current)
    }
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return // Initial pageshow must not play twice.
      hide()
      // Commit the settled state before restarting a restored document. No
      // remount, data reload, focus movement or storage marker is involved.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (!isLoading) setEntry({ view, playing: true, ready: false })
        })
      })
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      cancelFrame()
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [isLoading, view])

  return { playing, preparing, containerRef }
}
