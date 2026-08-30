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

for (const width of [390, 320] as const) {
  test(`workspace editors stay usable without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()

    await navigateWorkspace(page, 'Tasks')
    await page.getByRole('button', { name: 'New task' }).click()
    await page.getByRole('textbox', { name: 'Task title' }).fill(`Responsive task ${width}`)
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save' }))
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toContainText('Task created.')

    const edit = page.getByRole('button', { name: `Edit Responsive task ${width}` })
    await expect(edit).toBeVisible()
    const rowSize = await edit.evaluate((el) => {
      const box = el.getBoundingClientRect()
      return { w: Math.round(box.width), h: Math.round(box.height) }
    })
    expect(rowSize.w).toBeGreaterThanOrEqual(44)
    expect(rowSize.h).toBeGreaterThanOrEqual(44)

    await navigateWorkspace(page, 'Notes')
    await page.getByRole('button', { name: 'New note' }).click()
    await page.getByRole('textbox', { name: 'Note title' }).fill(`Responsive note ${width}`)
    await page.getByLabel('Body').fill('Long body copy for mobile editor wrapping and textarea height.')
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save' }))
    await page.getByRole('button', { name: 'Cancel' }).click()

    await navigateWorkspace(page, 'Subjects')
    await page.getByRole('button', { name: 'New subject' }).click()
    await page.getByLabel('Subject name').fill(`Responsive subject ${width}`)
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save' }))
    await page.getByRole('button', { name: 'Cancel' }).click()

    await navigateWorkspace(page, 'Calendar')
    await expect(page.getByLabel('Seven day calendar')).toBeVisible()
    await assertNoPageOverflow(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Event title').fill(`Responsive event with a long location-ready title ${width}`)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save' }))
    await page.getByRole('button', { name: 'Cancel' }).click()

    await navigateWorkspace(page, 'Progress')
    await page.getByRole('button', { name: 'Log session' }).click()
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save session' }))
    await page.getByRole('button', { name: 'Cancel' }).click()

    await navigateWorkspace(page, 'Goals')
    await page.getByRole('button', { name: 'New goal' }).click()
    await page.getByLabel('Goal title').fill(`Responsive goal ${width}`)
    await assertNoPageOverflow(page)
    await assertAboveMobileNav(page, page.getByRole('button', { name: 'Save' }))
    await page.getByRole('button', { name: 'Cancel' }).click()

    await navigateWorkspace(page, 'Settings')
    await assertNoPageOverflow(page)
    await page.getByRole('button', { name: /Reset all study data/i }).evaluate((el) => {
      el.scrollIntoView({ block: 'end', inline: 'nearest' })
    })
    const settingsClearance = await page.evaluate(() => {
      const nav = document.querySelector('.mobile-navigation')
      const btn = [...document.querySelectorAll('button')].find((candidate) =>
        /Reset all study data/i.test(candidate.textContent || ''),
      )
      if (!nav || !btn) return null
      return btn.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1
    })
    expect(settingsClearance).toBe(true)
  })
}

test('ConfirmDialog stays in viewport with adequate actions at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.goto('/')
  await navigateWorkspace(page, 'Tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByRole('textbox', { name: 'Task title' }).fill('Delete me on mobile')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Task created.')
  await page.getByRole('button', { name: 'Delete Delete me on mobile' }).click()

  const dialog = page.getByRole('dialog', { name: 'Confirm deletion' })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(390 + 1)
  await expect(dialog.getByRole('button', { name: 'Delete' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  const deleteSize = await dialog.getByRole('button', { name: 'Delete' }).evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return Math.round(rect.height)
  })
  expect(deleteSize).toBeGreaterThanOrEqual(44)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('Quick add, search, and More remain contained with workspace chrome at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  await assertNoPageOverflow(page)

  await page.getByRole('button', { name: 'Quick add' }).click()
  await expect(page.getByRole('menu', { name: 'Quick add' })).toBeVisible()
  await assertNoPageOverflow(page)
  await page.keyboard.press('Escape')

  await page.getByRole('combobox', { name: 'Search' }).fill('zzzz')
  await expect(page.getByRole('listbox')).toBeVisible()
  await assertNoPageOverflow(page)
  await page.getByRole('button', { name: 'Clear search' }).click()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'More' }).click()
  const more = page.getByRole('menu', { name: 'More destinations' })
  await expect(more).toBeVisible()
  const moreBox = await more.boundingBox()
  expect(moreBox).not.toBeNull()
  expect(moreBox!.x).toBeGreaterThanOrEqual(0)
  expect(moreBox!.x + moreBox!.width).toBeLessThanOrEqual(320 + 1)
})

test('mobile workspace axe smoke without suppressions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await navigateWorkspace(page, 'Tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  await expectNoAxeViolations(page, testInfo)
})
