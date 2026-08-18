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
  const direct = navButton(page, name)
  if (await direct.count()) {
    await direct.click()
    return
  }
  await navButton(page, 'More').click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}
