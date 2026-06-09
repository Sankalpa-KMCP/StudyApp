import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudyAppProvider } from '../StudyAppProvider'
import { FocusTab } from '../../components/tabs/FocusTab'

describe('StudyAppProvider integration', () => {
  it('adds a focus task through FocusTab', async () => {
    const user = userEvent.setup()
    render(
      <StudyAppProvider>
        <FocusTab />
      </StudyAppProvider>,
    )

    const input = await screen.findByPlaceholderText('What do you want to focus on?', {}, { timeout: 10000 })
    const taskName = 'Integration focus task'
    await user.type(input, `${taskName}{Enter}`)

    await waitFor(() => {
      expect(screen.getAllByText(taskName)[0]).toBeInTheDocument()
    })
  })
})
