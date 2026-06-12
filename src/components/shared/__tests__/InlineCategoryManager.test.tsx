import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineCategoryManager } from '../InlineCategoryManager'

describe('InlineCategoryManager', () => {
  it('requests confirmation before deleting a category', async () => {
    const user = userEvent.setup()
    const requestConfirm = vi.fn().mockResolvedValue(false)
    const deleteCategory = vi.fn()

    render(
      <InlineCategoryManager
        categories={[{ id: 1, name: 'Math', color: '#3B82F6' }]}
        addCategory={vi.fn()}
        deleteCategory={deleteCategory}
        requestConfirm={requestConfirm}
      />,
    )

    await user.click(screen.getByText('✏️ Manage'))
    await user.click(screen.getByRole('button', { name: 'Delete category Math' }))

    expect(requestConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Delete "Math"?',
      danger: true,
    }))
    expect(deleteCategory).not.toHaveBeenCalled()
  })
})
