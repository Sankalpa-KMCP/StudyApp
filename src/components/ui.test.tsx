import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Check } from 'lucide-react'
import { ProgressBar, EmptyState, PanelHeader, MetricCard, SegmentedControl, RowActionButtons } from './ui'

describe('UI Components', () => {
  describe('ProgressBar', () => {
    it('renders label and calculates width correctly', () => {
      render(<ProgressBar value={75} label="75%" />)
      expect(screen.getByRole('progressbar', { name: '75%' })).toHaveAttribute('aria-valuenow', '75')
    })

    it('clamps the accessible value to the valid percentage range', () => {
      render(<ProgressBar value={140} label="Complete" />)

      expect(screen.getByRole('progressbar', { name: 'Complete' })).toHaveAttribute('aria-valuenow', '100')
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
      render(<PanelHeader title="My Workspace" description="Keep the work organized." actionLabel="Add New" onAction={handleAction} />)
      
      expect(screen.getByRole('heading', { level: 1, name: 'My Workspace' })).toBeInTheDocument()
      expect(screen.getByText('Keep the work organized.')).toBeInTheDocument()
      const button = screen.getByRole('button', { name: 'Add New' })
      
      fireEvent.click(button)
      expect(handleAction).toHaveBeenCalledTimes(1)
    })

    it('does not render an empty action when none is provided', () => {
      render(<PanelHeader title="Settings" description="Manage local data." />)

      expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('SegmentedControl', () => {
    it('exposes the selected option to assistive technology', () => {
      const handleChange = vi.fn()
      render(<SegmentedControl value="open" options={['all', 'open', 'done']} onChange={handleChange} />)

      expect(screen.getByRole('button', { name: 'open' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'all' })).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(screen.getByRole('button', { name: 'done' }))
      expect(handleChange).toHaveBeenCalledWith('done')
    })
  })

  describe('RowActionButtons', () => {
    it('requires confirmation before a destructive row action', () => {
      const handleDelete = vi.fn()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
      render(<RowActionButtons label="Practice set" onEdit={() => {}} onDelete={handleDelete} />)

      fireEvent.click(screen.getByRole('button', { name: 'Delete Practice set' }))
      expect(handleDelete).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Delete Practice set' }))
      expect(confirm).toHaveBeenCalledWith('Delete Practice set? This cannot be undone.')
      expect(handleDelete).toHaveBeenCalledTimes(1)

      confirm.mockRestore()
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
