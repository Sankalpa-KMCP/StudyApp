import type { Page } from '@playwright/test'

type Sample = { opacity: number; transform: string; top: number; time: number | null }
type Motion = { name: string; delay: number; duration: number; samples: Sample[]; ended: boolean; cancelled: boolean }
declare global { interface Window { siteMotion: Motion[]; entranceStarts: Record<string, number> } }

/** Observe real native playback. Never pause, seek, finish, or restart it. */
export async function observeEntrance(page: Page, theme?: string, workspace = false) {
  await page.addInitScript(({ theme, workspace }) => {
    if (theme) localStorage.setItem('study-dashboard-theme', theme)
    const motion: Motion[] = window.siteMotion = []
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
      return { opacity: Number(style.opacity), transform: style.transform, top: (element as HTMLElement).offsetTop, time: typeof animation.currentTime === 'number' ? animation.currentTime : null }
    }
    const frame = () => {
      for (const [animation, { element, evidence }] of tracked) evidence.samples.push(sample(animation, element))
      if (document.querySelector('.is-entry-playing')) requestAnimationFrame(frame)
      else frameScheduled = false
    }
    const observer = new MutationObserver(() => {
      if (tracked.size >= names.size) return
      const root = document.querySelector('.content-grid.is-entry-playing')?.closest('.app-shell')
      if (!root) return
      for (const animation of root.getAnimations({ subtree: true })) {
        const name = (animation as CSSAnimation).animationName
        const element = (animation.effect as KeyframeEffect | null)?.target
        if (!names.has(name) || !(element instanceof Element)) continue
        if (motion.some(item => item.name === name)) continue
        const timing = animation.effect!.getTiming()
        const evidence: Motion = { name, delay: Number(timing.delay), duration: Number(timing.duration), samples: [sample(animation, element)], ended: false, cancelled: false }
        motion.push(evidence)
        tracked.set(animation, { element, evidence })
        void animation.finished.then(() => {
          evidence.ended = true
          evidence.samples.push(sample(animation, element))
        }).catch(() => {
          evidence.cancelled = true
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
      }
    }, true)
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true })
  }, { theme, workspace })
}
