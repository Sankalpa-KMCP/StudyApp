import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavTabButton } from '../NavTabButton'
import { Target } from 'lucide-react'

describe('NavTabButton', () => {
  it('uses locked aria-label without aria-disabled when focus lockout is active', () => {
    render(
      <NavTabButton
        variant="sidebar-expanded"
        tabId="analytics"
        label="Analytics"
        icon={Target}
        iconColor="text-accent-blue"
        accent="analytics"
        isActive={false}
        isLocked
        onClick={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: /Analytics, focus lockout active/i })
    expect(button).not.toHaveAttribute('aria-disabled')
    expect(button).toHaveAttribute('data-locked', 'true')
  })
})
