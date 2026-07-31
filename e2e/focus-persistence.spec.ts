import { expect, test } from '@playwright/test'
import {
  elapsedLabel,
  focusCard,
  listStudySessions,
  parseElapsedToSeconds,
  readActiveFocusSession,
  seedActiveFocusSession,
  startOpenEndedFocus,
  waitForMeasurableElapsed,
  waitMs,
  type FocusSessionSeed,
} from './focusHelpers'

/**
 * Phase 1 focus persistence — browser validation against real IndexedDB.
 * Seeding via IndexedDB is used only for expired/stale timestamps the UI cannot create.
 */

test.describe('focus session persistence', () => {
  test('reloads restore a running session from IndexedDB', async ({ page }) => {
    await startOpenEndedFocus(page)
    await waitForMeasurableElapsed(page)

    const before = await readActiveFocusSession(page)
    expect(before).not.toBeNull()
    expect(before?.status).toBe('running')
    const elapsedBefore = parseElapsedToSeconds(await elapsedLabel(page).innerText())

    await page.reload()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Start focus' })).toHaveCount(0)

    const after = await readActiveFocusSession(page)
    expect(after?.id).toBe(before!.id)
    expect(after?.startedAt).toBe(before!.startedAt)
    expect(after?.status).toBe('running')

    await expect
      .poll(async () => parseElapsedToSeconds(await elapsedLabel(page).innerText()), { timeout: 5_000 })
      .toBeGreaterThanOrEqual(elapsedBefore)
  })

  test('paused reload freezes elapsed and resume excludes pause wall time', async ({ page }) => {
    await startOpenEndedFocus(page)
    await waitForMeasurableElapsed(page)

    await page.getByRole('button', { name: 'Pause' }).click()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
    await expect(focusCard(page).getByText('paused', { exact: true })).toBeVisible()

    const frozenElapsed = await elapsedLabel(page).innerText()
    const frozenSeconds = parseElapsedToSeconds(frozenElapsed)
    const sessionBefore = await readActiveFocusSession(page)
    expect(sessionBefore?.status).toBe('paused')

    // Wall time while paused must not advance the durable/display clock.
    await waitMs(2_500)
    expect(await elapsedLabel(page).innerText()).toBe(frozenElapsed)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 15_000 })
    await expect(focusCard(page).getByText('paused', { exact: true })).toBeVisible()
    await expect(elapsedLabel(page)).toHaveText(frozenElapsed)

    await waitMs(2_000)
    expect(await elapsedLabel(page).innerText()).toBe(frozenElapsed)

    await page.getByRole('button', { name: 'Resume' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

    const afterResumeSeconds = parseElapsedToSeconds(await elapsedLabel(page).innerText())
    // Resume must not fold in the paused wall interval (~4.5s here).
    expect(afterResumeSeconds).toBeGreaterThanOrEqual(frozenSeconds)
    expect(afterResumeSeconds).toBeLessThanOrEqual(frozenSeconds + 2)

    const sessionAfter = await readActiveFocusSession(page)
    expect(sessionAfter?.id).toBe(sessionBefore!.id)
    expect(sessionAfter?.status).toBe('running')
    expect(sessionAfter?.accumulatedPausedMs ?? 0).toBeGreaterThanOrEqual(2_000)
  })

  test('closing and reopening a page restores the unfinished session', async ({ browser }) => {
    const context = await browser.newContext()
    const page1 = await context.newPage()

    await startOpenEndedFocus(page1)
    await waitForMeasurableElapsed(page1)
    const before = await readActiveFocusSession(page1)
    expect(before).not.toBeNull()

    await page1.close()

    const page2 = await context.newPage()
    await page2.goto('/')
    await expect(page2.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 15_000 })
    await expect(page2.getByRole('button', { name: 'Start focus' })).toHaveCount(0)

    const after = await readActiveFocusSession(page2)
    expect(after?.id).toBe(before!.id)
    expect(after?.startedAt).toBe(before!.startedAt)
    expect(after?.status).toBe('running')

    await context.close()
  })

  test('expired timed session auto-completes once with planned minutes', async ({ page }) => {
    const sessionId = 'focus-e2e-expired-25'
    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString()
    const seed: FocusSessionSeed = {
      id: sessionId,
      subjectId: '',
      startedAt,
      plannedMinutes: 25,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }

    // Seed required: UI cannot start already-expired timers.
    await seedActiveFocusSession(page, seed)
    await page.reload()

    await expect(page.getByRole('status')).toContainText(/Session complete:.*25/, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled()
    await expect(await readActiveFocusSession(page)).toBeNull()

    const history = await listStudySessions(page)
    expect(history).toHaveLength(1)
    expect(history[0]?.id).toBe(sessionId)
    expect(history[0]?.minutes).toBe(25)
    expect(history[0]?.note).toMatch(/Completed focus session/i)

    // AC-6: rerenders / navigation must not duplicate history.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Progress' }).click()
    await page.getByRole('button', { name: 'Home' }).click()
    await waitMs(1_500)

    expect(await listStudySessions(page)).toHaveLength(1)
    expect(await readActiveFocusSession(page)).toBeNull()
  })

  test('discarding a stale session removes it without history', async ({ page }) => {
    const sessionId = 'focus-e2e-stale-discard'
    const startedAt = new Date(Date.now() - 13 * 60 * 60_000).toISOString()
    const seed: FocusSessionSeed = {
      id: sessionId,
      subjectId: '',
      startedAt,
      plannedMinutes: 0,
      status: 'running',
      pausedAt: null,
      accumulatedPausedMs: 0,
    }

    // Seed required: UI cannot age a session past the 12h stale threshold in-test.
    await seedActiveFocusSession(page, seed)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Unfinished focus session' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Discard session' }).click()

    await expect(page.getByRole('button', { name: 'Start focus' })).toBeEnabled({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Focus session' })).toBeVisible()
    await expect(page.getByRole('status')).toContainText(/discarded/i)

    expect(await readActiveFocusSession(page)).toBeNull()
    expect(await listStudySessions(page)).toHaveLength(0)
  })

  test('resuming a stale session restores identity and blocks a second start', async ({ page }) => {
    const sessionId = 'focus-e2e-stale-resume'
    const startedAt = new Date(Date.now() - 13 * 60 * 60_000).toISOString()
    const pausedAt = new Date(Date.now() - 12.5 * 60 * 60_000).toISOString()
    const seed: FocusSessionSeed = {
      id: sessionId,
      subjectId: '',
      startedAt,
      plannedMinutes: 0,
      status: 'paused',
      pausedAt,
      accumulatedPausedMs: 0,
    }

    // Seed required: stale decision path needs a ≥12h startedAt.
    await seedActiveFocusSession(page, seed)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Unfinished focus session' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Start focus' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Resume session' }).click()
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible({ timeout: 15_000 })
    await expect(focusCard(page).getByText('paused', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start focus' })).toHaveCount(0)

    const restored = await readActiveFocusSession(page)
    expect(restored?.id).toBe(sessionId)
    expect(restored?.startedAt).toBe(startedAt)
    expect(restored?.status).toBe('paused')
    expect(restored?.pausedAt).toBe(pausedAt)

    // No second concurrent session — Start remains unavailable while this one is active.
    await expect(page.getByRole('button', { name: 'Start focus' })).toHaveCount(0)
    expect(await listStudySessions(page)).toHaveLength(0)
  })
})
