import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmDialog } from './ConfirmDialog'

const meta: Meta<typeof ConfirmDialog> = {
  title: 'Shared/ConfirmDialog',
  component: ConfirmDialog,
}

export default meta
type Story = StoryObj<typeof ConfirmDialog>

export const Destructive: Story = {
  args: {
    open: true,
    title: 'Sweep selected tables?',
    message: 'Are you sure you want to sweep the selected workspace databases? This cannot be undone.',
    confirmLabel: 'Sweep Selected',
    danger: true,
    onConfirm: () => {},
    onCancel: () => {},
  },
}
