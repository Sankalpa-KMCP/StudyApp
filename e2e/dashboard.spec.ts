import { expect, test, type Page } from '@playwright/test'
import { HOME_GREETING_HEADING } from './a11yHelpers'
import {
  createManualGoalViaUi,
  createStudyTimeGoalViaUi,
  exportStudyBackupViaSettings,
  goalCard,
  listGoals,
} from './focusHelpers'

function navButton(page: Page, name: string) {
  return page.getByLabel('Main navigation').getByRole('button', { name, exact: true })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('renders a blank database-backed dashboard and persists tasks', async ({ page }) => {
  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Weekly Progress' })).toBeVisible()
  await expect(page.getByText('No tasks yet')).toBeVisible()

  await navButton(page, 'Tasks').click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Geometry revision')
  await page.getByLabel('Minutes').fill('35')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Geometry revision')).toBeVisible()
  await page.reload()
  await navButton(page, 'Tasks').click()
  await expect(page.getByText('Geometry revision')).toBeVisible()

  await page.getByRole('combobox', { name: 'Search' }).fill('geometry')
  await expect(page.getByRole('main').getByRole('heading', { name: 'Geometry revision' })).toBeVisible()
  await expect(page.getByRole('option', { name: /Task.*Geometry revision/i })).toBeVisible()
  await expect(page.getByText('Chemistry lab report')).toBeHidden()
})

test('creates a note and navigates with linked controls', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Notes' }).click()
  await expect(page.getByRole('heading', { name: 'Notes' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'New note' }).click()
  await page.getByLabel('Note title').fill('Sunday study plan')
  await page.getByLabel('Body').fill('Two review blocks and one practice paper.')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Sunday study plan')).toBeVisible()
})

test('opens new task and subject editors from the home hero', async ({ page }) => {
  const hero = page.locator('section[aria-label="Today overview"]')

  await hero.getByRole('button', { name: 'Task' }).click()
  await expect(page.getByRole('heading', { name: 'Tasks' }).first()).toBeVisible()
  await expect(page.getByLabel('Task title')).toBeVisible()

  await navButton(page, 'Home').click()
  await hero.getByRole('button', { name: 'Subject' }).click()
  await expect(page.getByRole('heading', { name: 'Subjects' }).first()).toBeVisible()
  await expect(page.getByLabel('Subject name')).toBeVisible()
})

test('guides the first study loop without overflowing compact layouts', async ({ page }, testInfo) => {
  const compactWidth = testInfo.project.name === 'mobile-chrome' ? 320 : 501
  await page.setViewportSize({ width: compactWidth, height: 844 })

  const checklist = page.getByRole('region', { name: 'Your first study loop' })
  const checklistProgress = checklist.getByRole('progressbar', { name: 'First study loop progress' })
  await expect(checklist).toBeVisible()
  await expect(checklistProgress).toHaveAttribute('aria-valuetext', '0 of 3 steps complete')

  await checklist.getByRole('button', { name: 'Create subject' }).click()
  await expect(page.getByLabel('Subject name')).toBeFocused()
  await page.getByLabel('Subject name').fill('Physics')
  await page.getByRole('button', { name: 'Save' }).click()

  await navButton(page, 'Home').click()
  await expect(checklistProgress).toHaveAttribute('aria-valuetext', '1 of 3 steps complete')
  await checklist.getByRole('button', { name: 'Plan task' }).click()
  await expect(page.getByLabel('Task title')).toBeFocused()
  await page.getByLabel('Task title').fill('Momentum practice')
  await page.getByRole('button', { name: 'Save' }).click()

  await navButton(page, 'Home').click()
  await expect(checklistProgress).toHaveAttribute('aria-valuetext', '2 of 3 steps complete')
  await checklist.getByRole('button', { name: 'Log session' }).click()
  const sessionForm = page.getByRole('form', { name: 'Log study session' })
  await expect(sessionForm.getByLabel('Subject')).toBeFocused()
  const localStart = await page.evaluate(() => {
    const date = new Date(Date.now() - 60 * 60_000)
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    }
  })
  await sessionForm.getByLabel('Subject').selectOption({ label: 'Physics' })
  await sessionForm.getByLabel('Date').fill(localStart.date)
  await sessionForm.getByLabel('Start time').fill(localStart.time)
  await sessionForm.getByLabel('Duration (minutes)').fill('30')
  await sessionForm.getByRole('button', { name: 'Save session' }).click()

  await navButton(page, 'Home').click()
  await expect(checklist).toBeHidden()
  const layout = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }))
  expect(layout.page).toBeLessThanOrEqual(layout.viewport)
})

test('creates and reviews a flashcard', async ({ page }) => {
  await navButton(page, 'Flashcards').click()
  await page.getByRole('button', { name: 'New card' }).click()
  await page.getByLabel('Front').fill('Photosynthesis')
  await page.getByLabel('Back').fill('Plants convert light into chemical energy.')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Photosynthesis')).toBeVisible()
  await expect(page.getByText('Answer hidden')).toBeVisible()
  await page.getByRole('button', { name: 'Reveal' }).click()
  await expect(page.getByText('Plants convert light into chemical energy.')).toBeVisible()
  await page.getByRole('button', { name: 'Remembered' }).click()
  const card = page.locator('article.flashcard').filter({ hasText: 'Photosynthesis' })
  await expect(card.locator('.status-badge')).toHaveText('remembered')
})

test('logs, edits, and confirms deletion of a study session', async ({ page }) => {
  await navButton(page, 'Subjects').click()
  await page.getByRole('button', { name: 'New subject' }).click()
  await page.getByLabel('Subject name').fill('Physics')
  await page.getByRole('button', { name: 'Save' }).click()

  await navButton(page, 'Progress').click()
  await page.getByRole('button', { name: 'Log session' }).click()
  const sessionForm = page.getByRole('form', { name: 'Log study session' })
  const localStart = await page.evaluate(() => {
    const date = new Date(Date.now() - 90 * 60_000)
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    }
  })
  await sessionForm.getByLabel('Subject').selectOption({ label: 'Physics' })
  await sessionForm.getByLabel('Date').fill(localStart.date)
  await sessionForm.getByLabel('Start time').fill(localStart.time)
  await sessionForm.getByLabel('Duration (minutes)').fill('30')
  await sessionForm.getByLabel('Note Optional').fill('Reviewed momentum problems')
  await sessionForm.getByRole('button', { name: 'Save session' }).click()

  const journal = page.getByRole('region', { name: 'Study journal' })
  await expect(journal.getByText('Physics')).toBeVisible()
  await expect(journal.getByText('Reviewed momentum problems')).toBeVisible()
  await expect(journal.getByRole('article', { name: /Physics, .*30m/ })).toBeVisible()

  await journal.getByRole('button', { name: /Edit Physics session at/ }).click()
  const editForm = page.getByRole('form', { name: 'Edit study session' })
  await editForm.getByLabel('Duration (minutes)').fill('45')
  await editForm.getByLabel('Note Optional').fill('Momentum review complete')
  await editForm.getByRole('button', { name: 'Update session' }).click()
  await expect(journal.getByText('Momentum review complete')).toBeVisible()

  await journal.getByRole('button', { name: /Delete Physics session at/ }).click()
  await expect(page.getByRole('dialog', { name: 'Confirm deletion' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Confirm deletion' }).getByRole('button', { name: 'Cancel' }).click()
  await expect(journal.getByText('Physics')).toBeVisible()

  await journal.getByRole('button', { name: /Delete Physics session at/ }).click()
  await page.getByRole('dialog', { name: 'Confirm deletion' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Study session deleted.')).toBeVisible()
  await expect(page.getByText('No sessions logged')).toBeVisible()
})

test('subject study-time progress matches on cards and global search', async ({ page }) => {
  await navButton(page, 'Subjects').click()
  await page.getByRole('button', { name: 'New subject' }).click()
  await expect(page.getByLabel('Progress mode')).toHaveValue('manual')
  await expect(page.getByLabel('Progress %')).toBeVisible()

  await page.getByLabel('Subject name').fill('Optics')
  await page.getByLabel('Progress mode').selectOption('study_time')
  await expect(page.getByLabel('Progress %')).toHaveCount(0)
  await page.getByLabel('Target hours').fill('1')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Subject created.', { timeout: 15_000 })
  await expect(page.getByRole('progressbar', { name: '0%' })).toBeVisible()

  await navButton(page, 'Progress').click()
  await page.getByRole('button', { name: 'Log session' }).click()
  const sessionForm = page.getByRole('form', { name: 'Log study session' })
  const localStart = await page.evaluate(() => {
    const date = new Date(Date.now() - 90 * 60_000)
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    }
  })
  await sessionForm.getByLabel('Subject').selectOption({ label: 'Optics' })
  await sessionForm.getByLabel('Date').fill(localStart.date)
  await sessionForm.getByLabel('Start time').fill(localStart.time)
  await sessionForm.getByLabel('Duration (minutes)').fill('30')
  await sessionForm.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByRole('status')).toContainText('Study session recorded.', { timeout: 15_000 })

  await navButton(page, 'Subjects').click()
  await expect(page.getByRole('progressbar', { name: '50%' })).toBeVisible()

  await navButton(page, 'Home').click()
  const homeSubjects = page.locator('section.subject-section')
  await expect(homeSubjects.getByRole('progressbar', { name: '50%' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Search' }).fill('Optics')
  await expect(page.getByRole('option', { name: /Subject.*Optics.*50% progress/i })).toBeVisible()
})

test('rapid double save creates a single task that survives reload', async ({ page }) => {
  await navButton(page, 'Tasks').click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Single persistence task')
  await page.getByLabel('Minutes').fill('25')

  // Synchronous double activation before React can re-render; component tests prove the pending guard.
  await page.getByRole('button', { name: 'Save' }).evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expect(page.getByRole('status')).toContainText('Task created.', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Single persistence task' })).toHaveCount(1)

  await page.reload()
  await navButton(page, 'Tasks').click()
  await expect(page.getByRole('heading', { name: 'Single persistence task' })).toHaveCount(1)
})

test('shows subject and task mutation feedback through create, edit, complete, and delete', async ({ page }) => {
  await navButton(page, 'Subjects').click()
  await page.getByRole('button', { name: 'New subject' }).click()
  await page.getByLabel('Subject name').fill('Mutation Chemistry')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Subject created.', { timeout: 15_000 })
  await expect(page.getByText('Mutation Chemistry')).toBeVisible()

  await navButton(page, 'Tasks').click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Lab write-up')
  await page.getByLabel('Subject').selectOption({ label: 'Mutation Chemistry' })
  await page.getByLabel('Minutes').fill('40')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Task created.', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Lab write-up' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit Lab write-up' }).click()
  await page.getByLabel('Task title').fill('Lab write-up revised')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toContainText('Task updated.', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Lab write-up revised' })).toBeVisible()

  await page.getByRole('button', { name: 'Toggle Lab write-up revised' }).click()
  await expect(page.getByRole('status')).toContainText('Task marked complete.', { timeout: 15_000 })
  await expect(page.locator('article.list-row.is-done').filter({ hasText: 'Lab write-up revised' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete Lab write-up revised' }).click()
  await page.getByRole('dialog', { name: 'Confirm deletion' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('status')).toContainText('Task deleted.', { timeout: 15_000 })
  await expect(page.getByText('Lab write-up revised')).toHaveCount(0)

  await page.reload()
  await navButton(page, 'Tasks').click()
  await expect(page.getByText('Lab write-up revised')).toHaveCount(0)
  await navButton(page, 'Subjects').click()
  await expect(page.getByText('Mutation Chemistry')).toBeVisible()
})

test('collapses the sidebar at medium desktop widths and persists the preference', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  const sidebar = page.getByRole('complementary', { name: 'Main navigation' })
  const sidebarWidth = () => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))

  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await expect.poll(sidebarWidth).toBeGreaterThan(200)

  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await expect.poll(sidebarWidth).toBeLessThan(100)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('study-dashboard-sidebar'))).toBe('collapsed')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await expect.poll(sidebarWidth).toBeLessThan(100)

  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await expect.poll(sidebarWidth).toBeGreaterThan(200)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('study-dashboard-sidebar'))).toBe('expanded')
})

test('switches and persists all seven themes without layout overflow', async ({ page }, testInfo) => {
  const compact = testInfo.project.name === 'mobile-chrome'
  await page.setViewportSize({ width: compact ? 390 : 1280, height: compact ? 844 : 900 })
  await page.goto('/')

  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('monochrome')
  await expect.poll(() => page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))).toBe('#111111')
  await navButton(page, 'Settings').click()

  const themeGroup = page.getByRole('radiogroup', { name: 'Theme' })
  await expect(themeGroup.getByRole('radio')).toHaveCount(7)
  const themes = [
    ['Monochrome', 'monochrome', '#111111'],
    ['Canvas', 'light', '#f4f0e8'],
    ['Blueprint', 'blueprint', '#153f73'],
    ['Moss Library', 'moss', '#294633'],
    ['Midnight', 'dark', '#10141d'],
    ['Aurora', 'aurora', '#111323'],
    ['Ember', 'ember', '#f3e4d2'],
  ] as const

  for (const [label, theme, themeColor] of themes) {
    const option = themeGroup.getByRole('radio', { name: new RegExp(label) })
    await option.click()
    await expect(option).toHaveAttribute('aria-checked', 'true')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
    await expect.poll(() => page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute('content'))).toBe(themeColor)
    const layout = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }))
    expect(layout.page).toBeLessThanOrEqual(layout.viewport)
  }

  await themeGroup.getByRole('radio', { name: /Moss Library/ }).click()
  await page.reload()
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('moss')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('study-dashboard-theme'))).toBe('moss')

  if (!compact) {
    await page.setViewportSize({ width: 830, height: 900 })
    await navButton(page, 'Progress').click()
    await page.getByRole('button', { name: 'Log session', exact: true }).click()
    const layout = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }))
    expect(layout.page).toBeLessThanOrEqual(layout.viewport)
  }
})

test('keeps the dashboard usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => localStorage.setItem('study-dashboard-sidebar', 'collapsed'))
  await page.goto('/')

  await expect(page.getByRole('heading', { name: HOME_GREETING_HEADING })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByPlaceholder('Search')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Go to dashboard' })).toBeHidden()
  await navButton(page, 'Tasks').click()
  await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible()
  await navButton(page, 'Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
})

test('shows an actionable Today dashboard and keyboard-activates the recommendation', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const today = page.locator('section.home-today-card')
  await expect(today.getByRole('listitem', { name: '0 tasks due today' })).toBeVisible()
  await expect(today.getByRole('listitem', { name: '0 overdue tasks' })).toBeVisible()
  await expect(today.getByText('Recommended next')).toBeVisible()
  await expect(today.getByRole('heading', { name: 'Create a subject' })).toBeVisible()

  await today.getByRole('button', { name: 'Create subject' }).focus()
  await expect(today.getByRole('button', { name: 'Create subject' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Subjects', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Subject name')).toBeVisible()
})

test('keeps the actionable Home dashboard within 320px without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const today = page.locator('section.home-today-card')
  await expect(today.getByRole('button', { name: 'Create subject' })).toBeVisible()

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(layout.page).toBeLessThanOrEqual(layout.viewport)

  const actionAboveNav = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.trim() === 'Create subject' && candidate.classList.contains('home-recommended-action'),
    )
    const nav = document.querySelector('.sidebar')
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

test('populated desktop Home shows due counts and recommends the overdue task', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await navButton(page, 'Subjects').click()
  await page.getByRole('button', { name: 'New subject' }).click()
  await page.getByLabel('Subject name').fill('Chemistry')
  await page.getByRole('button', { name: 'Save' }).click()

  const yesterday = await page.evaluate(() => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })

  await navButton(page, 'Tasks').click()
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Overdue stoichiometry')
  await page.getByLabel('Due date').fill(yesterday)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Overdue stoichiometry')).toBeVisible()

  await navButton(page, 'Home').click()
  const today = page.locator('section.home-today-card')
  await expect(today.getByRole('listitem', { name: '1 overdue tasks' })).toBeVisible()
  await expect(today.getByRole('heading', { name: 'Overdue task' })).toBeVisible()
  await expect(today.getByText(/Catch up on "Overdue stoichiometry"/)).toBeVisible()

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }))
  expect(layout.page).toBeLessThanOrEqual(layout.viewport)

  await today.getByRole('button', { name: 'Open Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tasks', level: 1 })).toBeVisible()
  await expect(page.getByText('Overdue stoichiometry')).toBeVisible()
})

test('explicit goal metrics use persisted metric rather than title text', async ({ page }) => {
  const manualTitle = 'Study every day'
  const studyTitle = 'Weekly target'

  await createManualGoalViaUi(page, manualTitle, 10, 5)
  const manualGoal = goalCard(page, manualTitle)
  await expect(manualGoal.getByText('Manual progress')).toBeVisible()
  await expect(manualGoal.getByText('Daily', { exact: true })).toBeVisible()
  await expect(manualGoal.getByText('5/10 points')).toBeVisible()

  await createStudyTimeGoalViaUi(page, studyTitle, 'weekly', 5)
  const studyGoal = goalCard(page, studyTitle)
  await expect(studyGoal.getByText('Study time')).toBeVisible()
  await expect(studyGoal.getByText('Weekly', { exact: true })).toBeVisible()
  await expect(studyGoal.getByText('0/5 hours')).toBeVisible()

  await navButton(page, 'Progress').click()
  await page.getByRole('button', { name: 'Log session' }).click()
  const sessionForm = page.getByRole('form', { name: 'Log study session' })
  const localStart = await page.evaluate(() => {
    const date = new Date(Date.now() - 60 * 60_000)
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
    }
  })
  await sessionForm.getByLabel('Date').fill(localStart.date)
  await sessionForm.getByLabel('Start time').fill(localStart.time)
  await sessionForm.getByLabel('Duration (minutes)').fill('60')
  await sessionForm.getByRole('button', { name: 'Save session' }).click()
  await expect(page.getByRole('status')).toContainText('Study session recorded.', { timeout: 15_000 })

  await navButton(page, 'Goals').click()
  await expect(studyGoal.getByText('1/5 hours')).toBeVisible()
  await expect(studyGoal.getByRole('progressbar', { name: '20%' })).toBeVisible()
  await expect(manualGoal.getByText('Manual progress')).toBeVisible()
  await expect(manualGoal.getByText('5/10 points')).toBeVisible()

  const goalsBeforeReload = await listGoals(page)
  expect(goalsBeforeReload.find((goal) => goal.title === manualTitle)?.metric).toBe('manual')
  expect(goalsBeforeReload.find((goal) => goal.title === studyTitle)?.metric).toBe('study_time')

  await page.reload()
  await navButton(page, 'Goals').click()
  await expect(manualGoal.getByText('Manual progress')).toBeVisible()
  await expect(manualGoal.getByText('5/10 points')).toBeVisible()
  await expect(studyGoal.getByText('Study time')).toBeVisible()
  await expect(studyGoal.getByText('1/5 hours')).toBeVisible()

  const goalsAfterReload = await listGoals(page)
  expect(goalsAfterReload.find((goal) => goal.title === manualTitle)?.metric).toBe('manual')
  expect(goalsAfterReload.find((goal) => goal.title === studyTitle)?.metric).toBe('study_time')

  const exported = await exportStudyBackupViaSettings(page)
  expect(exported.version).toBe(3)
  expect(exported.goals.find((goal) => goal.title === manualTitle)?.metric).toBe('manual')
  expect(exported.goals.find((goal) => goal.title === studyTitle)?.metric).toBe('study_time')
  expect(Array.isArray(exported.subjects)).toBe(true)
  expect(
    exported.subjects.every(
      (subject) => subject.progressMode === 'manual' || subject.progressMode === 'study_time',
    ),
  ).toBe(true)
})

test('keeps Settings danger actions above the mobile bottom nav after focus scroll', async ({ page }) => {
  // Equivalent CSS viewport for 200% zoom of a 1280×900 window.
  await page.setViewportSize({ width: 640, height: 450 })
  await page.getByRole('button', { name: 'Settings', exact: true }).click()

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
  expect(Number.parseFloat(layout.scrollPaddingBottom)).toBeGreaterThanOrEqual(72)

  const reset = page.getByRole('button', { name: /Reset all study data/i })
  await reset.focus()
  await reset.evaluate((el) => el.scrollIntoView({ block: 'end', inline: 'nearest' }))

  const clearance = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((candidate) =>
      /Reset all study data/i.test(candidate.textContent || ''),
    )
    const nav = document.querySelector('.sidebar')
    if (!btn || !nav) return null
    const buttonBox = btn.getBoundingClientRect()
    const navBox = nav.getBoundingClientRect()
    return {
      fullyAboveNav: buttonBox.bottom <= navBox.top + 1,
      navPosition: getComputedStyle(nav).position,
    }
  })

  expect(clearance).not.toBeNull()
  expect(clearance?.navPosition).toBe('fixed')
  expect(clearance?.fullyAboveNav).toBe(true)
})
