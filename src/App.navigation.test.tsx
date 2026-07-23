import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { flushDeferredAppWork, resetAppTestEnvironment } from './test/appTestSetup'

describe('App navigation', () => {
  beforeEach(async () => {
    await resetAppTestEnvironment()
  })

  afterEach(async () => {
    await flushDeferredAppWork()
  })

  it('keeps a single Tasks workspace h1 while the topbar view label stays visible non-heading chrome', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Tasks' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)

    const topbar = document.querySelector('.topbar')
    expect(topbar).not.toBeNull()
    expect(within(topbar as HTMLElement).getByText('Tasks')).toBeInTheDocument()
    expect(within(topbar as HTMLElement).queryByRole('heading')).not.toBeInTheDocument()
  })

  it('implements profile and progress log-session controls', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Profile' }))
    const notices = await screen.findAllByText(/Profile settings live in this local/i)
    expect(notices.length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Progress' }))
    const logSessionButton = screen.getByRole('button', { name: 'Log session' })
    await user.click(logSessionButton)
    expect(await screen.findByRole('heading', { name: 'Log study session' })).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Stop session' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Log study session' })).not.toBeInTheDocument()
    expect(logSessionButton).toHaveFocus()
  })

  it('navigates to Calendar from Upcoming widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const viewAllBtn = within(rightColumn).getByRole('button', { name: 'View all' })
    await user.click(viewAllBtn)

    // Confirm Calendar view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New event' })).toBeInTheDocument()
  })

  it('navigates to Flashcards from Review Queue widget', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening)/ })

    const rightColumn = screen.getByRole('complementary', { name: 'Progress and schedule' })
    const reviewCardsBtn = within(rightColumn).getByRole('button', { name: 'Review cards' })
    await user.click(reviewCardsBtn)

    // Confirm Flashcards view is open by looking for its unique action button
    expect(await screen.findByRole('button', { name: 'New card' })).toBeInTheDocument()
  })
})
