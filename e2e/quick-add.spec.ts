import { expect, test } from '@playwright/test'

async function openQuickAdd(page: import('@playwright/test').Page, item: 'Task' | 'Note' | 'Event' | 'Focus session') {
  await page.getByRole('button', { name: 'Quick add' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('quick-add opens Task create from Home with focused title', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible()

  await openQuickAdd(page, 'Task')
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByLabel('Task title')).toBeVisible()
  await expect(page.getByLabel('Task title')).toBeFocused()
})

test('quick-add opens Note and Event create editors', async ({ page }) => {
  await page.goto('/')

  await openQuickAdd(page, 'Note')
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByLabel('Note title')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  await openQuickAdd(page, 'Event')
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByLabel('Event title')).toBeVisible()
})

test('quick-add Focus session from Tasks focuses Start without starting', async ({ page }) => {
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { level: 1, name: 'Tasks' })).toBeVisible()

  await page.getByRole('button', { name: 'Quick add' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'Quick add' })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: 'Focus session' })).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/$/)
  const start = page.getByRole('button', { name: 'Start focus' })
  await expect(start).toBeEnabled()
  await expect(start).toBeFocused()
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0)
})

test('quick-add menu is keyboard operable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Quick add' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'Quick add' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Task' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Note' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/notes$/)
  await expect(page.getByLabel('Note title')).toBeVisible()
})

for (const width of [390, 320] as const) {
  test(`quick-add remains reachable without page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Quick add' })).toBeVisible()

    const overflowX = await page.evaluate(() => {
      const root = document.documentElement
      return root.scrollWidth > root.clientWidth + 1
    })
    expect(overflowX).toBe(false)

    await page.getByRole('button', { name: 'Quick add' }).click()
    const menu = page.getByRole('menu', { name: 'Quick add' })
    await expect(menu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Focus session' })).toBeVisible()
    const box = await menu.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)

    await page.getByRole('menuitem', { name: 'Focus session' }).click()
    const focusCard = page.locator('#home-focus-session')
    await expect(focusCard).toBeVisible()
    const cardBox = await focusCard.boundingBox()
    expect(cardBox).not.toBeNull()
    // Card top remains above the fixed bottom navigation band.
    expect(cardBox!.y).toBeLessThan(844 - 64)
  })
}
