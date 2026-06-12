import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSectionNav } from '../SettingsSectionNav'
import { scrollToSettingsSection } from '../../../lib/settings/settingsSections'

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('SettingsSectionNav', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="settings-appearance" data-settings-section></section>
      <section id="settings-focus" data-settings-section></section>
      <section id="settings-data" data-settings-section></section>
    `
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all section links', () => {
    render(<SettingsSectionNav />)
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Study' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument()
  })

  it('scrolls to section on click', () => {
    render(<SettingsSectionNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Data' }))
    expect(scrollToSettingsSection).toBeDefined()
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
