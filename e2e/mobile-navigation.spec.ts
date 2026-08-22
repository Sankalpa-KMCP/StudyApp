import { expect, test, type Page } from '@playwright/test'
import { HOME_GREETING_HEADING, expectNoAxeViolations } from './a11yHelpers'

async function openMore(page: Page) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'More' }).click()
}

test('mobile bottom navigation fits five labeled destinations without horizontal scroll at 390px and 320px', async ({ page }) => {
  for (const width of [390, 320] as const) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await expect(nav).toBeVisible()
    for (const label of ['Home', 'Tasks', 'Notes', 'Progress', 'More'] as const) {
      await expect(nav.getByRole('button', { name: label })).toBeVisible()
    }

    const overflow = await page.evaluate(() => {
      const navigation = document.querySelector('.mobile-navigation')
      if (!navigation) return { page: true, nav: true }
      return {
        page: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        nav: navigation.scrollWidth > navigation.clientWidth + 1,
      }
    })
    expect(overflow.page, `${width}px page overflow`).toBe(false)
    expect(overflow.nav, `${width}px nav overflow`).toBe(false)
  }
})

test('More menu reaches every secondary route with active state and Back/Forward', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const destinations = [
    { label: 'Subjects', path: /\/subjects$/ },
    { label: 'Calendar', path: /\/calendar$/ },
    { label: 'Goals', path: /\/goals$/ },
    { label: 'Settings', path: /\/settings$/ },
  ] as const

  for (const destination of destinations) {
    await openMore(page)
    await page.getByRole('menuitem', { name: destination.label }).click()
    await expect(page).toHaveURL(destination.path)
    await expect(page.getByRole('heading', { level: 1, name: destination.label })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'More' })).toHaveClass(/is-active/)
  }

  await page.goBack()
  await expect(page).toHaveURL(/\/goals$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/settings$/)
})

test('More supports keyboard-only open, Escape dismiss, and destination activation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'More' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'More destinations' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Subjects' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More' })).toBeFocused()

  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/calendar$/)
})

test('desktop Sidebar remains at desktop width while mobile nav is absent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0)
})

test('mobile navigation keeps primary Home actions above the fixed bar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()

  const actionAboveNav = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.trim() === 'Create subject' && candidate.classList.contains('home-recommended-action'),
    )
    const nav = document.querySelector('.mobile-navigation')
    if (!button || !nav) return null
    button.scrollIntoView({ block: 'end', inline: 'nearest' })
    const buttonBox = button.getBoundingClientRect()
    const navBox = nav.getBoundingClientRect()
    return {
      fullyAboveNav: buttonBox.bottom <= navBox.top + 1,
      navPosition: getComputedStyle(nav).position,
    }
  })
  expect(actionAboveNav).not.toBeNull()
  expect(actionAboveNav?.navPosition).toBe('fixed')
  expect(actionAboveNav?.fullyAboveNav).toBe(true)
})

test('mobile navigation landmark passes axe smoke without suppressions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
  await openMore(page)
  await expectNoAxeViolations(page, testInfo)
})
