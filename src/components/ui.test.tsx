import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Check } from 'lucide-react'
import {
  ProgressBar,
  EmptyState,
  PanelHeader,
  MetricCard,
  SegmentedControl,
  RowActionButtons,
  EditorActions,
  MutationNotice,
} from './ui'

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

  describe('MutationNotice', () => {
    it('renders success feedback with status semantics', () => {
      render(<MutationNotice phase="success" message="Study data imported." />)

      expect(screen.getByRole('status')).toHaveTextContent('Study data imported.')
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    })

    it('renders error feedback with alert semantics', () => {
      render(<MutationNotice phase="error" message="Could not save this session. Try again." />)

      expect(screen.getByRole('alert')).toHaveTextContent('Could not save this session. Try again.')
    })

    it('renders nothing when the message is null', () => {
      const { container } = render(<MutationNotice phase="success" message={null} />)

      expect(container).toBeEmptyDOMElement()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('renders nothing while pending even if a stale message is provided', () => {
      const { container } = render(<MutationNotice phase="pending" message="Saved." />)

      expect(container).toBeEmptyDOMElement()
    })

    it('invokes dismiss with an accessible control name', () => {
      const onDismiss = vi.fn()
      render(<MutationNotice phase="success" message="Session logged." onDismiss={onDismiss} />)

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  describe('EditorActions', () => {
    it('keeps ordinary non-loading behavior compatible', () => {
      const onSave = vi.fn()
      const onCancel = vi.fn()
      render(<EditorActions onSave={onSave} onCancel={onCancel} />)

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    })

    it('disables actions and shows the loading label while saving', () => {
      render(
        <EditorActions
          onSave={() => {}}
          onCancel={() => {}}
          isLoading
          loadingLabel="Saving task..."
        />,
      )

      const saveButton = screen.getByRole('button', { name: 'Saving task...' })
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })
  })
})
