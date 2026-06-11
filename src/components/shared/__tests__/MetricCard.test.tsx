import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Clock } from 'lucide-react'
import { MetricCard } from '../MetricCard'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Monthly Study Time" value="12.5h" icon={Clock} />)
    expect(screen.getByText('Monthly Study Time')).toBeInTheDocument()
    expect(screen.getByText('12.5h')).toBeInTheDocument()
  })
})
