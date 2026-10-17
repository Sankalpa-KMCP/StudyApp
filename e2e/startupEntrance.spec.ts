import { expect, test, type Page } from '@playwright/test'
import { HOME_GREETING_HEADING, expectNoAxeViolations } from './a11yHelpers'
import { navigateWorkspace } from './navHelpers'
import { exportStudyBackupViaSettings } from './focusHelpers'
import { observeEntrance } from './entranceObserver'


const runtimeErrors = new WeakMap<Page, { errors: string[]; expected404: boolean }>()
test.beforeEach(async ({ page }) => {
  const state = { errors: [] as string[], expected404: false }
  runtimeErrors.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  page.on('requestfailed', request => state.errors.push(`network: ${request.url()}`))
  page.on('console', message => { if (message.type() === 'error') state.errors.push(`console: ${message.text()}`) })
  page.on('response', response => {
    if (response.status() < 400) return
    if (response.status() === 404 && response.request().isNavigationRequest() && /\/(tasks|settings)$/.test(new URL(response.url()).pathname)) state.expected404 = true
    else state.errors.push(`HTTP ${response.status()}: ${response.url()}`)
  })
})
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    await testInfo.attach('entrance-diagnostics', {
      body: JSON.stringify(await page.evaluate(() => ({ motion: window.siteMotion, timeline: window.siteMotionTimeline, classes: document.querySelector('.content-grid')?.className }))),
      contentType: 'application/json',
    })
  }
  const state = runtimeErrors.get(page)!
  expect(state.errors.filter(error => !(state.expected404 && /^console: .*Failed to load resource:.*404/.test(error)))).toEqual([])
})

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 600 }]) {
  for (const theme of ['monochrome', 'wisteria', 'crystal-glass']) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      test(`startup ${viewport.width}px, ${theme}, ${reducedMotion}`, async ({ page }, testInfo) => {
        test.slow()
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
        page.on('requestfailed', (request) => errors.push(request.url()))
        page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
        await page.setViewportSize(viewport)
        await page.emulateMedia({ reducedMotion })
        await observeEntrance(page, theme)

        const assertStartup = async () => {
          await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
          await expect(page.locator('#app-preloader')).toHaveCount(0)
          const hero = page.locator('.hero-row')
          if (reducedMotion === 'no-preference') {
            // The completion window begins after native playback is released,
            // not while the browser is still painting its prepared keyframe.
            await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-preparing/, { timeout: 15_000 })
            await expect.poll(() => page.evaluate(() => window.siteMotion.find(item => item.name === 'heroContentSettle')?.ended), { timeout: 20_000 }).toBe(true).catch(async (error) => {
              await testInfo.attach('startup-animation-evidence', { body: JSON.stringify(await page.evaluate(() => window.siteMotion)), contentType: 'application/json' })
              throw error
            })
            const evidence = await page.evaluate(() => window.siteMotion.find(item => item.name === 'heroContentSettle')!)
            await testInfo.attach('native-hero-motion', { body: JSON.stringify(evidence), contentType: 'application/json' })
            expect(evidence.duration).toBe(760)
            expect(evidence.cancelled).toBe(false)
            expect(evidence.samples.some(sample => sample.transform !== 'none' || (sample.opacity > 0.15 && sample.opacity < 0.9))).toBe(true)
            expect(Math.max(...evidence.samples.map(sample => sample.opacity)) - Math.min(...evidence.samples.map(sample => sample.opacity))).toBeGreaterThan(0.5)
            expect(evidence.samples.at(-1)!.opacity).toBeGreaterThan(0.99)
          } else {
            expect(await page.evaluate(() => window.siteMotion)).toEqual([])
            expect(await hero.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
          }
          await expect(hero).toHaveCSS('opacity', '1')
          await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/, { timeout: 20_000 })
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        }
        await page.goto('./')
        await assertStartup()
        await page.reload()
        await assertStartup()
        // Routing disables the HTTP cache: also exercise a cache-bypassing reload.
        await page.route('**/*', route => route.continue())
        await page.reload()
        await assertStartup()
        await page.unroute('**/*')
        const before = await page.evaluate(() => (window.entranceStarts.heroContentSettle ?? 0))
        await navigateWorkspace(page, 'Notes')
        await navigateWorkspace(page, 'Home')
        await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
        expect(await page.evaluate(() => (window.entranceStarts.heroContentSettle ?? 0))).toBe(before)
        await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
        if (viewport.width === 390 && theme === 'monochrome' && reducedMotion === 'reduce') await expectNoAxeViolations(page, testInfo, 'startup')
        expect(errors).toEqual([])
      })
    }
  }
}

test('isolated keyframe probe preserves the entrance easing without manipulating native startup', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  const samples = await page.evaluate(() => {
    // Separate inert probe, after the real entrance. No live application
    // animation is paused, sought, or restarted by this design-contract check.
    const probe = document.createElement('div')
    probe.className = 'content-grid is-entry-playing'
    probe.inert = true
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:300px'
    const hero = document.createElement('div')
    hero.className = 'hero-row'
    probe.append(hero)
    document.body.append(probe)
    try {
      const animation = hero.getAnimations().find(item => (item as CSSAnimation).animationName === 'heroContentSettle')!
      animation.pause()
      const delay = Number(animation.effect!.getTiming().delay)
      return [0, 152, 380, 750].map(time => {
        animation.currentTime = delay + time
        const style = getComputedStyle(hero)
        return { opacity: Number(style.opacity), transform: style.transform }
      })
    } finally { probe.remove() }
  })
  expect(samples).toHaveLength(4)
  expect(samples[0].opacity).toBeCloseTo(0.15)
  expect(samples[1].opacity).toBeGreaterThan(samples[0].opacity)
  expect(samples[2].opacity).toBeGreaterThan(samples[1].opacity)
  expect(samples[3].opacity).toBeGreaterThan(0.99)
  expect(samples[0].transform).not.toBe('none')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
})

test('entrance keeps the dashboard outside an animated opacity group', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  const styles = await page.evaluate(() => {
    // An independent probe checks the compositing boundary without changing
    // native playback. Fading this ancestor groups every glass card's blur.
    const probe = document.createElement('div')
    probe.className = 'app-shell'
    probe.inert = true
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:300px'
    const dashboard = document.createElement('main')
    dashboard.className = 'dashboard'
    const content = document.createElement('div')
    content.className = 'content-grid is-entry-playing'
    const hero = document.createElement('section')
    hero.className = 'hero-row'
    const primary = document.createElement('section')
    primary.className = 'primary-column'
    const summary = document.createElement('div')
    summary.className = 'summary-grid'
    const card = document.createElement('article')
    card.className = 'card'
    summary.append(card)
    primary.append(hero, summary)
    content.append(primary)
    dashboard.append(content)
    probe.append(dashboard)
    document.body.append(probe)
    try {
      return {
        dashboardAnimation: getComputedStyle(dashboard).animationName,
        dashboardOpacity: getComputedStyle(dashboard).opacity,
        heroAnimation: getComputedStyle(hero).animationName,
        summaryAnimation: getComputedStyle(summary).animationName,
        cardAnimation: getComputedStyle(card).animationName,
      }
    } finally { probe.remove() }
  })
  expect(styles).toEqual({ dashboardAnimation: 'none', dashboardOpacity: '1', heroAnimation: 'heroContentSettle', summaryAnimation: 'none', cardAnimation: 'workspaceGroupSettle' })
})

test('glass backdrop blur is deferred during entrance and restored after settlement', async ({ page }) => {
  await page.goto('./')
  const results = await page.evaluate(() => {
    const previousTheme = document.documentElement.dataset.theme
    const probe = document.createElement('div')
    probe.className = 'content-grid'
    probe.inert = true
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;left:-10000px;top:0;width:300px'
    const card = document.createElement('article')
    card.className = 'card'
    probe.append(card)
    document.body.append(probe)
    const backdrop = () => {
      const style = getComputedStyle(card)
      return style.getPropertyValue('backdrop-filter') || style.getPropertyValue('-webkit-backdrop-filter')
    }
    try {
      return ['crystal-glass', 'wisteria', 'celestial', 'velvet-dusk', 'abyss'].map(theme => {
        document.documentElement.dataset.theme = theme
        probe.className = 'content-grid is-entry-playing is-entry-preparing'
        const preparing = backdrop()
        probe.className = 'content-grid is-entry-playing'
        const playing = backdrop()
        probe.className = 'content-grid'
        return { theme, preparing, playing, settled: backdrop() }
      })
    } finally {
      probe.remove()
      if (previousTheme === undefined) delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = previousTheme
    }
  })
  for (const result of results) {
    expect(result.preparing, result.theme).toBe('none')
    expect(result.playing, result.theme).toBe('none')
    expect(result.settled, result.theme).toContain('blur(16px)')
  }
})

test('navigation during startup cancels motion without replaying it on immediate Home return', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
  await navigateWorkspace(page, 'Notes')
  await navigateWorkspace(page, 'Home')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
})

test('cancelled entrance leaves content visible and clears startup state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
  await page.locator('.app-shell').evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true })) animation.cancel()
  })
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
  await expect(page.locator('.hero-row')).toHaveCSS('transform', 'none')
})

for (const route of ['tasks', 'settings']) {
  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`direct ${route} entrance and shell choreography (${motion})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: motion })
      await observeEntrance(page, undefined, true)
      const verify = async () => {
        await expect(page.getByRole('heading', { level: 1, name: route === 'tasks' ? 'Tasks' : 'Settings', exact: true })).toBeVisible()
        await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
        const motionEvidence = await page.evaluate(() => window.siteMotion)
        if (motion === 'reduce') expect(motionEvidence).toEqual([])
        else {
          for (const name of ['siteBrandSettle', 'siteNavigationSettle', 'workspaceHeadingSettle', 'workspaceGroupSettle']) {
            const evidence = motionEvidence.find(item => item.name === name)!
            expect(evidence, name).toBeTruthy()
            expect(evidence.ended).toBe(true)
            expect(evidence.cancelled).toBe(false)
            expect(evidence.samples[0].opacity).toBeLessThan(evidence.samples.at(-1)!.opacity)
            expect(evidence.samples.some(sample => sample.opacity > evidence.samples[0].opacity && sample.opacity < 1)).toBe(true)
            expect(evidence.samples[0].transform).not.toBe('none')
            expect(Math.abs(evidence.samples[0].top - evidence.samples.at(-1)!.top)).toBeLessThanOrEqual(1)
          }
          expect(Math.max(...motionEvidence.map(item => item.delay + item.duration))).toBeGreaterThanOrEqual(1000)
          expect(Math.max(...motionEvidence.map(item => item.delay + item.duration))).toBeLessThanOrEqual(1200)
          await testInfo.attach('site-motion', { body: JSON.stringify(motionEvidence), contentType: 'application/json' })
        }
        for (const selector of ['.workspace-heading', '.topbar-title', '.topbar-actions']) {
          await expect(page.locator(selector)).toHaveCSS('opacity', '1')
          await expect(page.locator(selector)).toHaveCSS('transform', 'none')
        }
      }
      await page.goto(`./${route}`)
      await verify()
      await page.reload()
      await verify()
    })
  }
}

type MidEntryCapture = { playing: boolean; animation: string; index: number }

function midEntryCapture(indexExpression: string) {
  return `(() => {
    const active = document.activeElement
    if (!(active instanceof Element)) return { playing: false, animation: '', index: -1 }
    const index = ${indexExpression}
    return {
      playing: document.querySelector('.content-grid')?.classList.contains('is-entry-playing') === true,
      animation: getComputedStyle(active).animationName,
      index,
    }
  })()`
}

test('sidebar keyboard focus settles mid-entry and navigates on Enter', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Sidebar keyboard navigation is a desktop shell path')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  let duringEntry: MidEntryCapture | null = null
  for (let attempt = 0; attempt < 2 && duringEntry?.playing !== true; attempt++) {
    await page.goto('./')
    await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
    let navIndex = -1
    for (let i = 0; i < 10 && navIndex < 0; i++) {
      await page.keyboard.press('Tab')
      navIndex = (await page.evaluate<MidEntryCapture>(midEntryCapture(
        'Array.prototype.indexOf.call(document.querySelectorAll(\'.sidebar nav .nav-item\'), active)',
      ))).index
    }
    expect(navIndex).toBeGreaterThanOrEqual(0)
    duringEntry = await page.evaluate<MidEntryCapture>(midEntryCapture(
      'Array.prototype.indexOf.call(document.querySelectorAll(\'.sidebar nav .nav-item\'), active)',
    ))
  }
  // Keyboard focus must settle its own entrance immediately; a `:has()`-only
  // cancel rule cannot match the focused element itself.
  expect(duringEntry).toEqual({ playing: true, animation: 'none', index: 0 })
  for (let i = 0; i < 6 && duringEntry!.index < 1; i++) {
    await page.keyboard.press('Tab')
    duringEntry = await page.evaluate<MidEntryCapture>(midEntryCapture(
      'Array.prototype.indexOf.call(document.querySelectorAll(\'.sidebar nav .nav-item\'), active)',
    ))
  }
  expect(duringEntry!.index).toBe(1)
  await expect(page.locator('.sidebar nav .nav-item').nth(1)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks', exact: true })).toBeVisible()
})

test('early pointer navigation during entry playback reaches the sidebar target', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Sidebar pointer targeting is a desktop shell path')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
  const target = page.locator('.sidebar nav .nav-item').nth(1)
  const box = await target.boundingBox()
  expect(box).toBeTruthy()
  // Per-item entrances are transform-free: the hit target between pointerdown
  // and pointerup must not move even during the staggered fade window.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks', exact: true })).toBeVisible()
})

test('mobile keyboard focus settles mid-entry and navigates on Enter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 390, height: 600 })
  let duringEntry: MidEntryCapture | null = null
  for (let attempt = 0; attempt < 2 && duringEntry?.playing !== true; attempt++) {
    await page.goto('./')
    await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
    let mobileIndex = -1
    for (let i = 0; i < 10 && mobileIndex < 0; i++) {
      await page.keyboard.press('Tab')
      mobileIndex = (await page.evaluate<MidEntryCapture>(midEntryCapture(
        'Array.prototype.indexOf.call(document.querySelector(\'.mobile-navigation\')?.children ?? [], active)',
      ))).index
    }
    expect(mobileIndex).toBeGreaterThanOrEqual(0)
    duringEntry = await page.evaluate<MidEntryCapture>(midEntryCapture(
      'Array.prototype.indexOf.call(document.querySelector(\'.mobile-navigation\')?.children ?? [], active)',
    ))
  }
  expect(duringEntry).toEqual({ playing: true, animation: 'none', index: 0 })
  for (let i = 0; i < 6 && duringEntry!.index < 2; i++) {
    await page.keyboard.press('Tab')
    duringEntry = await page.evaluate<MidEntryCapture>(midEntryCapture(
      'Array.prototype.indexOf.call(document.querySelector(\'.mobile-navigation\')?.children ?? [], active)',
    ))
  }
  expect(duringEntry!.index).toBe(2)
  await expect(page.locator('.mobile-navigation > *').nth(2)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Notes', exact: true })).toBeVisible()
})

test('entrance stylesheet contract keeps per-item fades transform-free and keyboard-cancellable', async ({ page }) => {
  await page.goto('./')
  const sheetState = await page.evaluate(() => {
    const keyframes: { name: string; stops: Record<string, string>[] }[] = []
    const texts: string[] = []
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSKeyframesRule) {
          keyframes.push({
            name: rule.name,
            stops: Array.from(rule.cssRules).map(stop => {
              const style = (stop as CSSKeyframeRule).style
              const properties: Record<string, string> = {}
              for (let i = 0; i < style.length; i++) {
                const property = style.item(i)
                properties[property] = style.getPropertyValue(property)
              }
              return properties
            }),
          })
          continue
        }
        if (rule instanceof CSSStyleRule) { texts.push(rule.cssText); continue }
        if ('cssRules' in rule) { walk((rule as CSSGroupingRule).cssRules); continue }
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try { walk(sheet.cssRules) } catch { /* cross-origin sheet */ }
    }
    return { keyframes, css: texts.join('\n') }
  })
  const fade = sheetState.keyframes.find(item => item.name === 'siteNavigationFade')
  expect(fade).toBeTruthy()
  for (const stop of fade!.stops) {
    expect(Object.keys(stop).sort()).toEqual(['opacity'])
    expect(['0.35', '1']).toContain(stop.opacity)
  }
  expect(sheetState.css).toMatch(/siteNavigationSettle/)
  expect(sheetState.css).toMatch(/siteNavigationFade/)
  const expectedDelays = [
    { pattern: '(?:first-child|nth-child\\(1\\))', sec: '(?:0?\\.06s|60ms)' },
    { pattern: 'nth-child\\(2\\)', sec: '(?:0?\\.09s|90ms)' },
    { pattern: 'nth-child\\(3\\)', sec: '(?:0?\\.12s|120ms)' },
    { pattern: 'nth-child\\(4\\)', sec: '(?:0?\\.15s|150ms)' },
    { pattern: 'nth-child\\(5\\)', sec: '(?:0?\\.18s|180ms)' },
    { pattern: 'nth-child\\(6\\)', sec: '(?:0?\\.21s|210ms)' },
  ]
  for (const { pattern, sec } of expectedDelays) {
    expect(sheetState.css).toMatch(new RegExp(`\\.sidebar nav \\.nav-item:${pattern}[^{}]*\\{[^{}]*animation-delay:\\s*${sec}`))
  }
  expect(sheetState.css).toMatch(/\.sidebar nav \.nav-item:focus-visible/)
  expect(sheetState.css).toMatch(/\.mobile-navigation\s*>\s*:focus-visible/)
})


test('persisted pageshow replays once; ordinary pageshow and live updates do not', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('./')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  const initial = await page.locator('.hero-row').evaluate(element => {
    Object.assign(window, { restoreStarts: 0 })
    element.addEventListener('animationstart', event => { if ((event as AnimationEvent).animationName === 'heroContentSettle') window.restoreStarts++ })
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    return window.restoreStarts
  })
  expect(initial).toBe(0)
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await expect.poll(() => page.evaluate(() => window.restoreStarts)).toBe(1)
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  await page.getByPlaceholder('Search').fill('a new search')
  await expect(page.getByPlaceholder('Search')).toHaveValue('a new search')
  expect(await page.evaluate(() => window.restoreStarts)).toBe(1)
})

declare global { interface Window { restoreStarts: number } }

test('keyboard search works during entry without restarting the hero', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    window.restoreStarts = 0
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'heroContentSettle') window.restoreStarts++
    }, true)
  })
  await page.goto('./')
  await expect(page.locator('.content-grid')).toHaveClass(/is-entry-playing/)
  await page.keyboard.press('/')
  const search = page.getByPlaceholder('Search')
  await expect(search).toBeFocused()
  await page.keyboard.type('study')
  await expect(search).toHaveValue('study')
  await expect(page.locator('.topbar-actions')).toHaveCSS('transform', 'none')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  expect(await page.evaluate(() => window.restoreStarts)).toBe(1)
})

test('returning profile keeps appearance but replays on a new document; durable updates do not replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    window.restoreStarts = 0
    document.addEventListener('animationstart', event => {
      if (event.animationName === 'heroContentSettle') window.restoreStarts++
    }, true)
  })
  await page.goto('./')
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  await page.evaluate(() => localStorage.setItem('study-dashboard-theme', 'wisteria'))
  // A real new document in the same disposable profile reads saved preferences.
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wisteria')
  await expect.poll(() => page.evaluate(() => window.restoreStarts), { timeout: 15_000 }).toBe(1)
  await expect(page.locator('.content-grid')).not.toHaveClass(/is-entry-playing/)
  const notes = page.getByRole('textbox', { name: 'Quick notes', exact: true })
  await notes.fill('Synthetic live-query update')
  await notes.blur()
  await expect(page.getByText('Saved locally')).toBeVisible()
  expect(await page.evaluate(() => window.restoreStarts)).toBe(1)
  await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
  const exported = await exportStudyBackupViaSettings(page)
  expect(exported.settings.find(setting => setting.key === 'quickNotes')?.value).toEqual(['Synthetic live-query update'])
  expect(await page.evaluate(() => window.restoreStarts)).toBe(1)
})
