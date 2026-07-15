import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { TabLoadingFallback } from '../TabLoadingFallback'

describe('TabLoadingFallback', () => {
  it('renders loading label and panel skeletons', () => {
    const { container } = render(<TabLoadingFallback label="journal" />)
    expect(screen.getByText('Loading journal…')).toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders analytics variant with metrics row skeleton', () => {
    const { container } = render(<TabLoadingFallback label="analytics" variant="analytics" />)
    expect(screen.getByText('Loading analytics…')).toBeInTheDocument()
    expect(container.querySelectorAll('.skeleton-pulse').length).toBeGreaterThan(4)
  })
})

describe('reduced motion CSS guards', () => {
  it('wraps custom slide and fade animations behind prefers-reduced-motion', () => {
    const css = readFileSync(resolve(__dirname, '../../../styles/animations.css'), 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.animate-slide-in-up/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.animate-fade-in/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*\.animate-slide-down/)
  })

  it('disables tailwind pulse, ping, and spin under prefers-reduced-motion reduce', () => {
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.animate-pulse[\s\S]*\.animate-ping[\s\S]*\.animate-spin/)
  })
})
