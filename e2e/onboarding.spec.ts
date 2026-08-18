import { expect, test, type Page } from '@playwright/test'
import { expectNoAxeViolations, HOME_GREETING_HEADING } from './a11yHelpers'
import { navigateWorkspace } from './navHelpers'

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
  expect(overflow).toBe(false)
}

async function assertAboveMobileNav(page: Page, locator: ReturnType<Page['getByRole']>) {
  await locator.scrollIntoViewIfNeeded()
  const handle = await locator.elementHandle()
  expect(handle).not.toBeNull()
  const clearance = await page.evaluate((el) => {
    const nav = document.querySelector('.mobile-navigation')
    if (!nav || !el) return null
    const buttonBox = el.getBoundingClientRect()
    const navBox = nav.getBoundingClientRect()
    return {
      fullyAboveNav: buttonBox.bottom <= navBox.top + 1,
      height: Math.round(buttonBox.height),
    }
  }, handle)
  expect(clearance).not.toBeNull()
  expect(clearance?.fullyAboveNav).toBe(true)
  expect(clearance?.height ?? 0).toBeGreaterThanOrEqual(44)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
})

test('onboarding can be keyboard-dismissed, stays hidden after reload, and restarts from Settings', async ({ page }) => {
  const checklist = page.getByRole('region', { name: 'Your first study loop' })
  await expect(checklist).toBeVisible()
  await expect(checklist.getByRole('button', { name: 'Add task' })).toBeVisible()
  await expect(checklist.getByRole('button', { name: 'Go to focus' })).toBeVisible()

  await checklist.getByRole('button', { name: 'Create subject' }).click()
  await page.getByLabel('Subject name').fill('Physics')
  await page.getByRole('button', { name: 'Save' }).click()

  await navigateWorkspace(page, 'Home')
  await expect(checklist.getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute(
    'aria-valuetext',
    '1 of 3 steps complete',
  )

  const dismiss = checklist.getByRole('button', { name: 'Hide checklist' })
  await dismiss.focus()
  await page.keyboard.press('Enter')
  await expect(checklist).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeFocused()

  await page.reload()
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
  await expect(checklist).toBeHidden()

  await navigateWorkspace(page, 'Settings')
  await page.getByRole('button', { name: 'Show onboarding checklist' }).click()
  await expect(page.getByRole('status')).toContainText('Onboarding checklist will appear on Home.')

  await navigateWorkspace(page, 'Home')
  await expect(checklist).toBeVisible()
  await expect(checklist.getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute(
    'aria-valuetext',
    '1 of 3 steps complete',
  )
  await expect(checklist.locator('.first-study-step.is-complete .first-study-status')).toHaveText(/Complete/)
})

test('onboarding guides Subject, Task, and Focus workflow without auto-starting focus', async ({ page }) => {
  const checklist = page.getByRole('region', { name: 'Your first study loop' })
  await expect(checklist).toBeVisible()
  await expect(checklist.getByRole('heading', { name: 'Create a subject' })).toBeVisible()
  await expect(checklist.getByRole('heading', { name: 'Add your first task' })).toBeVisible()
  await expect(checklist.getByRole('heading', { name: 'Start a focus session' })).toBeVisible()

  await checklist.getByRole('button', { name: 'Create subject' }).click()
  await page.getByLabel('Subject name').fill('Biology')
  await page.getByRole('button', { name: 'Save' }).click()

  await navigateWorkspace(page, 'Home')
  await expect(checklist.getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute(
    'aria-valuetext',
    '1 of 3 steps complete',
  )

  await checklist.getByRole('button', { name: 'Add task' }).click()
  await page.getByLabel('Task title').fill('Read chapter 1')
  await page.getByRole('button', { name: 'Save' }).click()

  await navigateWorkspace(page, 'Home')
  await expect(checklist.getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute(
    'aria-valuetext',
    '2 of 3 steps complete',
  )

  const focusAction = checklist.getByRole('button', { name: 'Go to focus' })
  await focusAction.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Start focus' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Stop session' })).toHaveCount(0)
  await expect(checklist.getByRole('progressbar', { name: 'First study loop progress' })).toHaveAttribute(
    'aria-valuetext',
    '2 of 3 steps complete',
  )

  await page.getByRole('button', { name: 'Start focus' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(checklist).toBeHidden()
})

for (const width of [390, 320] as const) {
  test(`onboarding and Settings controls stay contained at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()

    const checklist = page.getByRole('region', { name: 'Your first study loop' })
    await expect(checklist).toBeVisible()
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, checklist.getByRole('button', { name: 'Hide checklist' }))

    await navigateWorkspace(page, 'Settings')
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Show onboarding checklist' }))

    if (width === 390 && testInfo.project.name === 'chromium') {
      await navigateWorkspace(page, 'Home')
      await expectNoAxeViolations(page, testInfo)
    }
  })
}
