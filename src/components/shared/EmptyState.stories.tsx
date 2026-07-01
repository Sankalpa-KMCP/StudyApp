import type { Meta, StoryObj } from '@storybook/react'
import { Target } from 'lucide-react'
import { EmptyState } from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  component: EmptyState,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'theme', values: [{ name: 'theme', value: 'var(--body-base, #05040a)' }] },
  },
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    icon: <Target className="h-8 w-8" />,
    title: 'No focus targets yet',
    description: 'Add a task to start your first study session.',
  },
}
