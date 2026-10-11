import { expect, test } from '@playwright/test'
import { expectNoAxeViolations, waitForSettledHome } from './a11yHelpers'
import { makeStudyExport, STUDY_DB_NAME } from './focusHelpers'
import { navigateWorkspace } from './navHelpers'

for (const height of [600, 844]) {
  for (const longFilename of [false, true]) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      test(`backup review fits 390x${height}, ${longFilename ? 'long' : 'normal'} filename, ${reducedMotion}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height })
        await page.emulateMedia({ reducedMotion })
        await waitForSettledHome(page)
        await navigateWorkspace(page, 'Settings')
        const input = page.getByLabel('Import data')
        await input.setInputFiles({
          name: longFilename ? `backup-${'x'.repeat(150)}.json` : 'backup.json',
          mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeStudyExport())),
        })
        const dialog = page.getByRole('dialog', { name: 'Review study backup' })
        await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
        await dialog.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
          element.scrollTop = 0
        })
        const geometry = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const backdrop = getComputedStyle(element.parentElement!)
          return {
            top: rect.top, bottom: rect.bottom,
            topClearance: parseFloat(backdrop.paddingTop),
            bottomClearance: parseFloat(backdrop.paddingBottom),
            horizontalOverflow: element.scrollWidth > element.clientWidth,
          }
        })
        expect(geometry.top).toBeGreaterThanOrEqual(geometry.topClearance - 1)
        expect(geometry.bottom).toBeLessThanOrEqual(height - geometry.bottomClearance + 1)
        expect(geometry.horizontalOverflow).toBe(false)
        const navigation = await page.getByLabel('Main navigation').boundingBox()
        expect(navigation).not.toBeNull()
        expect(geometry.bottom).toBeLessThanOrEqual(navigation!.y)

        // Check actual reachability inside the scrolling panel, not just DOM visibility.
        for (const target of [
          dialog.getByRole('heading', { name: 'Review study backup' }),
          dialog.locator('.confirm-dialog-description'),
          dialog.getByText(/Total records:/),
          dialog.getByRole('button', { name: 'Replace my study data', exact: true }),
          dialog.getByRole('button', { name: 'Cancel', exact: true }),
        ]) {
          await target.evaluate((element) => element.scrollIntoView({ block: 'nearest', behavior: 'instant' }))
          const box = await target.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.y).toBeGreaterThanOrEqual(geometry.top)
          expect(box!.y + box!.height).toBeLessThanOrEqual(geometry.bottom)
        }
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(input).toBeFocused()
      })
    }
  }
}

test('backup selection, export, keyboard cancellation and confirmed replacement are explicit and accessible', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await waitForSettledHome(page)
  await navigateWorkspace(page, 'Settings')
  const snapshot = () => page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      return await Promise.all(Array.from(db.objectStoreNames).map((table) => new Promise((resolve, reject) => {
        const request = db.transaction(table).objectStore(table).getAll()
        request.onsuccess = () => resolve({ table, rows: request.result })
        request.onerror = () => reject(request.error)
      })))
    } finally { db.close() }
  }, STUDY_DB_NAME)
  const before = await snapshot()
  const select = () => page.getByLabel('Import data').setInputFiles({
    name: 'review-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeStudyExport())),
  })
  await select()
  const dialog = page.getByRole('dialog', { name: 'Review study backup' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('replaces all current local study data')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  expect(await snapshot()).toEqual(before)
  await expectNoAxeViolations(page, testInfo, 'backup-review')
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Export current data first' }).click()
  expect((await download).suggestedFilename()).toMatch(/study-dashboard.*\.json/)
  await expect(dialog.getByRole('button', { name: 'Replace my study data' })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Import data')).toBeFocused()
  expect(await snapshot()).toEqual(before)
  await select()
  await dialog.getByRole('button', { name: 'Replace my study data' }).click()
  await expect(page.getByRole('status')).toContainText('Study data imported.')
  expect(await snapshot()).not.toEqual(before)
  expect(errors).toEqual([])
})
