import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Check } from 'lucide-react'
import { ProgressBar, EmptyState, PanelHeader, MetricCard } from './ui'

describe('UI Components', () => {
  describe('ProgressBar', () => {
    it('renders label and calculates width correctly', () => {
      render(<ProgressBar value={75} label="75%" />)
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  describe('EmptyState', () => {
    it('renders title, body, and action button', () => {
      const handleAction = vi.fn()
      render(
        <EmptyState 
          icon={Check} 
          title="No items found" 
          body="Please create an item" 
          actionLabel="Create Item" 
          onAction={handleAction} 
        />
      )
      
      expect(screen.getByText('No items found')).toBeInTheDocument()
      expect(screen.getByText('Please create an item')).toBeInTheDocument()
      
      const button = screen.getByRole('button', { name: 'Create Item' })
      expect(button).toBeInTheDocument()
      
      fireEvent.click(button)
      expect(handleAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('PanelHeader', () => {
    it('renders correctly and handles clicks', () => {
      const handleAction = vi.fn()
      render(<PanelHeader title="My Workspace" actionLabel="Add New" onAction={handleAction} />)
      
      expect(screen.getByRole('heading', { level: 2, name: 'My Workspace' })).toBeInTheDocument()
      const button = screen.getByRole('button', { name: 'Add New' })
      
      fireEvent.click(button)
      expect(handleAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('MetricCard', () => {
    it('renders label and value', () => {
      render(<MetricCard label="Total Hours" value="120" />)
      expect(screen.getByText('Total Hours')).toBeInTheDocument()
      expect(screen.getByText('120')).toBeInTheDocument()
    })
  })
})
