import { expect, test } from '@playwright/test'

test('slash focuses global search and keyboard selects a Task result', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()

  await page.getByRole('button', { name: 'Tasks' }).click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Global search alpha task')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Global search alpha task')).toBeVisible()

  await page.getByRole('button', { name: 'Home' }).click()
  await page.keyboard.press('/')
  const search = page.getByRole('combobox', { name: 'Search' })
  await expect(search).toBeFocused()
  await search.fill('alpha task')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()
  await expect(search).toHaveValue('')
})

test('global search no-results and clear flow', async ({ page }) => {
  await page.goto('/')
  const search = page.getByRole('combobox', { name: 'Search' })
  await search.fill('zzzz-no-match')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(page.getByText('No matches found')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('Back/Forward after search selection restores routes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Notes' }).click()
  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note title').fill('Searchable note beta')
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('button', { name: 'Home' }).click()
  const search = page.getByRole('combobox', { name: 'Search' })
  await search.fill('beta')
  await page.getByRole('option', { name: /Note.*Searchable note beta/i }).click()
  await expect(page).toHaveURL(/\/notes$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/notes$/)
})

for (const width of [390, 320] as const) {
  test(`global search stays in viewport without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    const search = page.getByRole('combobox', { name: 'Search' })
    await search.fill('study')
    const panel = page.locator('.global-search-panel')
    await expect(panel).toBeVisible()
    const box = await panel.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
    expect(box!.y).toBeLessThan(844 - 64)

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    expect(overflowX).toBe(false)
  })
}
