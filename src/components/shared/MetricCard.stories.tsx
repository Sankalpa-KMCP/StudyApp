import type { Meta, StoryObj } from '@storybook/react'
import { Clock, Flame } from 'lucide-react'
import { MetricCard } from './MetricCard'

const meta: Meta<typeof MetricCard> = {
  component: MetricCard,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'theme', values: [{ name: 'theme', value: 'var(--body-base, #05040a)' }] },
  },
}

export default meta
type Story = StoryObj<typeof MetricCard>

export const Default: Story = {
  args: {
    label: 'Monthly Study Time',
    value: '12.5h',
    icon: Clock,
    accent: 'blue',
  },
}

export const Streak: Story = {
  args: {
    label: 'Streak Status',
    value: '7 Days',
    icon: Flame,
    accent: 'amber',
  },
}
