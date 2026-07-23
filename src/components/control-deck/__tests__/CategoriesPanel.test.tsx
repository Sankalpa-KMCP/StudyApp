import './testUtils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriesPanel } from '../CategoriesPanel'
import { SettingsPanelProvider } from '../../../context/settingsPanelContext'
import { mockRequestConfirm, mockStudyCategories } from './testUtils'

describe('CategoriesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequestConfirm.mockResolvedValue(true)
    mockStudyCategories.categories = [{ id: 1, name: 'Math', color: '#3B82F6' }]
    mockStudyCategories.deleteCategory.mockResolvedValue(undefined)
  })

  afterEach(() => {
    mockStudyCategories.categories = []
  })

  it('uses confirm dialog instead of alert on delete', async () => {
    const user = userEvent.setup()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <SettingsPanelProvider>
        <CategoriesPanel />
      </SettingsPanelProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Show' }))
    await user.click(screen.getByRole('button', { name: /delete category math/i }))

    expect(mockRequestConfirm).toHaveBeenCalled()
    expect(alertSpy).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })
})
