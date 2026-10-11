import { expect, test, type Page } from '@playwright/test'
import { HOME_GREETING_HEADING, expectNoAxeViolations } from './a11yHelpers'
import { navigateWorkspace } from './navHelpers'
import { makeStudyExport, readActiveFocusSession, listStudySessions } from './focusHelpers'

const base = '/StudyApp/'
declare global { interface Window { productionEntrance: { opacity: number; duration: string }[] } }
const diagnostics = new WeakMap<Page, { errors: string[]; expected404s: string[] }>()
async function home(page: Page) {
  await page.goto(base)
  await expect(page.getByRole('heading', { level: 1, name: HOME_GREETING_HEADING })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled()
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  const expected404s: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('requestfailed', request => errors.push(`network: ${request.url()} ${request.failure()?.errorText}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('response', response => {
    if (response.status() < 400) return
    const path = new URL(response.url()).pathname
    if (response.status() === 404 && response.request().isNavigationRequest() && ['/StudyApp/tasks', '/StudyApp/settings'].includes(path)) expected404s.push(path)
    else errors.push(`HTTP ${response.status()}: ${response.url()}`)
  })
  // Capturing these in the test fixture keeps real CSP, script, and asset errors fatal.
  diagnostics.set(page, { errors, expected404s })
})
test.afterEach(async ({ page }, testInfo) => {
  const state = diagnostics.get(page)!
  const fallback = testInfo.title.includes('Pages fallback')
  if (fallback) expect(state.expected404s.length).toBeGreaterThanOrEqual(3)
  else expect(state.expected404s).toEqual([])
  // Browsers may emit a console resource error for the deliberately requested 404 document.
  const unexpected = state.errors.filter(error => !(fallback && state.expected404s.length > 0 && /^console: .*Failed to load resource:.*404/.test(error)))
  expect(unexpected).toEqual([])
})

for (const motion of ['no-preference', 'reduce'] as const) {
  test(`built startup, history and accessibility (${motion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: motion })
    await page.addInitScript(() => {
      Object.assign(window, { productionEntrance: [] })
      document.addEventListener('animationstart', event => {
        if (event.animationName !== 'heroContentSettle') return
        const style = getComputedStyle(event.target as Element)
        const evidence = window.productionEntrance
        evidence.push({ opacity: Number(style.opacity), duration: style.animationDuration })
      }, true)
    })
    await home(page)
    const evidence = () => page.evaluate(() => window.productionEntrance)
    if (motion === 'no-preference') {
      await expect.poll(async () => (await evidence()).length).toBe(1)
      expect((await evidence())[0].opacity).toBeLessThan(1)
      expect((await evidence())[0].duration).toBe('0.76s')
    } else expect(await evidence()).toEqual([])
    await expect(page.locator('.is-entry-playing')).toHaveCount(0)
    await expect(page.locator('.hero-row')).toHaveCSS('opacity', '1')
    const assets = await page.locator('script[src]').evaluateAll(elements => elements.map(element => element.getAttribute('src')))
    expect(assets.length).toBeGreaterThan(0)
    expect(assets.every(url => url?.startsWith('/StudyApp/assets/'))).toBe(true)
    const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(policy).toContain("script-src 'self' 'sha256-")
    for (const directive of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(policy).toContain(directive)
    }
    expect(policy).not.toContain("'unsafe-eval'")
    await navigateWorkspace(page, 'Tasks')
    await expect(page).toHaveURL(/\/StudyApp\/tasks$/)
    await navigateWorkspace(page, 'Notes')
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Tasks', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { level: 1, name: 'Notes', exact: true })).toBeVisible()
    await navigateWorkspace(page, 'Home')
    expect((await evidence()).length).toBe(motion === 'reduce' ? 0 : 1)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false)
    await page.reload()
    await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
    await expect.poll(async () => (await evidence()).length).toBe(motion === 'reduce' ? 0 : 1)
    // Like the existing accessibility specs, finish with the axe helper-page scan.
    await expectNoAxeViolations(page, testInfo, `production-home-${motion}`)
  })
}

test('Pages fallback uses the built 404 redirect on direct entry and refresh', async ({ page, request }) => {
  const response = await request.get(`${base}tasks?filter=one%26two`)
  expect(response.status()).toBe(404)
  expect(await response.text()).toContain('pathSegmentsToKeep = 1')
  for (const route of ['tasks', 'settings']) {
    await page.goto(`${base}${route}?filter=one%26two&flag&filter=x%3Dy#section`)
    await expect(page.getByRole('heading', { level: 1, name: route === 'tasks' ? 'Tasks' : 'Settings', exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/StudyApp/${route}\\?filter=one%26two&flag&filter=x%3Dy#section$`))
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: route === 'tasks' ? 'Tasks' : 'Settings', exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/StudyApp/${route}\\?filter=one%26two&flag&filter=x%3Dy#section$`))
  }
})

test('built focus persistence and explicit backup replacement recover from invalid selection', async ({ page }, testInfo) => {
  await home(page)
  await page.getByLabel('Session length').selectOption('0')
  await page.getByRole('button', { name: 'Start focus' }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  const paused = await readActiveFocusSession(page)
  expect(paused?.status).toBe('paused')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible()
  expect((await readActiveFocusSession(page))?.id).toBe(paused?.id)
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stop session' }).click()
  await expect(page.getByRole('status')).toContainText('Session stopped:')
  const history = await listStudySessions(page)
  expect(history).toHaveLength(1)
  expect(await readActiveFocusSession(page)).toBeNull()
  await navigateWorkspace(page, 'Settings')
  const input = page.getByLabel('Import data')
  await input.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByRole('alert')).toBeVisible()
  expect(await listStudySessions(page)).toEqual(history)
  const backup = { name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeStudyExport())) }
  await input.setInputFiles(backup)
  const dialog = page.getByRole('dialog', { name: 'Review study backup' })
  await expect(dialog).toBeVisible()
  expect(await listStudySessions(page)).toEqual(history)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(input).toBeFocused()
  expect(await listStudySessions(page)).toEqual(history)
  await input.setInputFiles(backup)
  await dialog.getByRole('button', { name: 'Replace my study data' }).click()
  await expect(page.getByRole('status')).toContainText('Study data imported.')
  expect(await listStudySessions(page)).toEqual([])
  await navigateWorkspace(page, 'Home')
  await page.reload()
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
  expect(await listStudySessions(page)).toEqual([])
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled()
  await navigateWorkspace(page, 'Settings')
  await page.getByLabel('Import data').setInputFiles(backup)
  await expect(dialog).toBeVisible()
  expect(await listStudySessions(page)).toEqual([])
  await expectNoAxeViolations(page, testInfo, 'production-backup-review')
})
