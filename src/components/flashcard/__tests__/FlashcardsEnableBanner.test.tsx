import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlashcardsEnableBanner } from '../FlashcardsEnableBanner'

describe('FlashcardsEnableBanner', () => {
  it('renders enable prompt and calls onEnable', async () => {
    localStorage.removeItem('flashcards_enable_banner_dismissed')
    const user = userEvent.setup()
    const onEnable = vi.fn()
    render(<FlashcardsEnableBanner onEnable={onEnable} />)
    expect(screen.getByText(/optional recall deck/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enable in Settings' }))
    expect(onEnable).toHaveBeenCalledTimes(1)
  })

  it('hides after dismiss', async () => {
    localStorage.removeItem('flashcards_enable_banner_dismissed')
    const user = userEvent.setup()
    const { container } = render(<FlashcardsEnableBanner onEnable={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(container).toBeEmptyDOMElement()
  })
})
