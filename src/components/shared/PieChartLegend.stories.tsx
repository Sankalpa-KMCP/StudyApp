import type { Meta, StoryObj } from '@storybook/react'
import { PieChartLegend } from './PieChartLegend'

const meta: Meta<typeof PieChartLegend> = {
  component: PieChartLegend,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'theme', values: [{ name: 'theme', value: 'var(--body-base, #05040a)' }] },
  },
}

export default meta
type Story = StoryObj<typeof PieChartLegend>

export const Subjects: Story = {
  args: {
    items: [
      { name: 'Math', color: '#007aff', value: 12, unit: 'h', percentage: 45 },
      { name: 'Physics', color: '#af52de', value: 8, unit: 'h', percentage: 30 },
      { name: 'History', color: '#34c759', value: 6, unit: 'h', percentage: 25 },
    ],
  },
}

export const Mood: Story = {
  args: {
    items: [
      { name: 'Focused', color: '#34c759', value: 5, unit: 'd', percentage: 50, emoji: '🎯' },
      { name: 'Tired', color: '#ff9500', value: 3, unit: 'd', percentage: 30, emoji: '😴' },
      { name: 'Stressed', color: '#ff3b30', value: 2, unit: 'd', percentage: 20, emoji: '😰' },
    ],
  },
}
