import type { Page } from '@playwright/test'
import { MOBILE_NAV_MAX_WIDTH_QUERY } from '../src/navigation/navDestinations'

function navButton(page: Page, name: string) {
  return page.getByLabel('Main navigation').getByRole('button', { name, exact: true })
}

/** Navigate via desktop Sidebar or mobile More menu depending on the active shell. */
export async function navigateWorkspace(page: Page, name: string) {
  const primary = new Set(['Home', 'Tasks', 'Notes', 'Progress', 'More'])
  if (primary.has(name)) {
    await navButton(page, name).click()
    return
  }
  // Viewport changes can precede React's responsive-shell commit. Choose the
  // expected shell from the browser query, then let locator actions wait for it.
  const mobile = await page.evaluate(query => window.matchMedia(query).matches, MOBILE_NAV_MAX_WIDTH_QUERY)
  if (mobile) {
    await navButton(page, 'More').click()
    await page.getByRole('menuitem', { name, exact: true }).click()
    return
  }
  await navButton(page, name).click()
}
