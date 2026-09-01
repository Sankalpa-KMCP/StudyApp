import type { Page } from '@playwright/test'

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
  const sidebar = page.locator('aside.sidebar')
  if (await sidebar.isVisible().catch(() => false)) {
    await navButton(page, name).click()
    return
  }
  const more = navButton(page, 'More')
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    await page.getByRole('menuitem', { name, exact: true }).click()
    return
  }
  await navButton(page, name).click()
}
