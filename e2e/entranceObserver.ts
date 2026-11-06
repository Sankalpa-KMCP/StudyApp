import type { Page } from '@playwright/test'

type Sample = { opacity: number; transform: string; top: number; time: number | null; wallTime: number; state: AnimationPlayState; pending: boolean }
type Motion = { id: number; name: string; delay: number; duration: number; samples: Sample[]; ended: boolean; cancelled: boolean }
type TimelineEvent = { kind: string; wallTime: number; classes: string | null; animations: { id: number; name: string; time: number | null; state: AnimationPlayState; pending: boolean }[] }
declare global { interface Window { siteMotion: Motion[]; siteMotionTimeline: TimelineEvent[]; entranceStarts: Record<string, number> } }

/** Observe real native playback. Never pause, seek, finish, or restart it. */
export async function observeEntrance(page: Page, theme?: string, workspace = false) {
  await page.addInitScript(({ theme, workspace }) => {
    if (theme) localStorage.setItem('study-dashboard-theme', theme)
    const motion: Motion[] = window.siteMotion = []
    const timeline: TimelineEvent[] = window.siteMotionTimeline = []
    window.entranceStarts = {}
    document.addEventListener('animationstart', event => {
      window.entranceStarts[event.animationName] = (window.entranceStarts[event.animationName] ?? 0) + 1
    }, true)
    // Read only the surfaces asserted by this scenario. Sampling every card's
    // computed style on every frame can itself starve high-DPI WebKit playback.
    const names = new Set(workspace
      ? ['siteBrandSettle', 'siteNavigationSettle', 'workspaceHeadingSettle', 'workspaceGroupSettle']
      : ['heroContentSettle'])
    const tracked = new Map<Animation, { element: Element; evidence: Motion }>()
    let frameScheduled = false
    const sample = (animation: Animation, element: Element): Sample => {
      const style = getComputedStyle(element)
      return { opacity: Number(style.opacity), transform: style.transform, top: (element as HTMLElement).offsetTop, time: typeof animation.currentTime === 'number' ? animation.currentTime : null, wallTime: performance.now(), state: animation.playState, pending: animation.pending }
    }
    const record = (kind: string) => timeline.push({
      kind, wallTime: performance.now(), classes: document.querySelector('.content-grid')?.className ?? null,
      animations: Array.from(tracked, ([animation, { evidence }]) => ({ id: evidence.id, name: evidence.name, time: typeof animation.currentTime === 'number' ? animation.currentTime : null, state: animation.playState, pending: animation.pending })),
    })
    const frame = () => {
      for (const [animation, { element, evidence }] of tracked) evidence.samples.push(sample(animation, element))
      if (document.querySelector('.is-entry-playing')) requestAnimationFrame(frame)
      else frameScheduled = false
    }
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(mutation => mutation.target instanceof Element && mutation.target.matches('.content-grid'))) record('class mutation')
      if (tracked.size >= names.size) return
      const root = document.querySelector('.content-grid.is-entry-playing')?.closest('.app-shell')
      if (!root) return
      for (const animation of root.getAnimations({ subtree: true })) {
        const name = (animation as CSSAnimation).animationName
        const element = (animation.effect as KeyframeEffect | null)?.target
        if (!names.has(name) || !(element instanceof Element)) continue
        if (motion.some(item => item.name === name)) continue
        const timing = animation.effect!.getTiming()
        const evidence: Motion = { id: tracked.size + 1, name, delay: Number(timing.delay), duration: Number(timing.duration), samples: [sample(animation, element)], ended: false, cancelled: false }
        motion.push(evidence)
        tracked.set(animation, { element, evidence })
        record('discovered')
        void animation.finished.then(() => {
          evidence.ended = true
          evidence.samples.push(sample(animation, element))
          record('finished promise')
        }).catch(() => {
          evidence.cancelled = true
          record('cancelled promise')
        })
      }
      if (tracked.size > 0 && !frameScheduled) {
        frameScheduled = true
        requestAnimationFrame(frame)
      }
    })
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    for (const kind of ['animationend', 'animationcancel'] as const) document.addEventListener(kind, event => {
      for (const [animation, { element, evidence }] of tracked) {
        if (event.target !== element || (event as AnimationEvent).animationName !== evidence.name) continue
        if (kind === 'animationend') evidence.ended = true
        else evidence.cancelled = true
        evidence.samples.push(sample(animation, element))
        record(kind)
      }
    }, true)
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true })
  }, { theme, workspace })
}
