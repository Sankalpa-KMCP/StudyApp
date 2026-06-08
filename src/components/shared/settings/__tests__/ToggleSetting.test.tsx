import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToggleSetting } from '../ToggleSetting'

describe('ToggleSetting', () => {
  it('toggles via switch', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleSetting label="Sound" checked={false} onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
