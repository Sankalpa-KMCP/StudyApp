import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudyAppProvider } from '../StudyAppProvider'
import { useStudyApp } from '../useStudyApp'

function Probe() {
  const { isDataReady, activeTab } = useStudyApp()
  return (
    <div>
      <span data-testid="ready">{String(isDataReady)}</span>
      <span data-testid="tab">{activeTab}</span>
    </div>
  )
}

describe('StudyAppProvider', () => {
  it('composes nested providers and exposes app state', async () => {
    render(
      <StudyAppProvider>
        <Probe />
      </StudyAppProvider>,
    )
    expect(screen.getByTestId('tab')).toHaveTextContent('focus')
    await screen.findByTestId('ready')
  })
})
