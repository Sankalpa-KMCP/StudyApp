import type { Meta, StoryObj } from '@storybook/react'
import { PanelHeader } from './PanelHeader'
import { PanelCard } from './PanelCard'

const meta: Meta<typeof PanelHeader> = {
  component: PanelHeader,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'theme', values: [{ name: 'theme', value: 'var(--body-base, #05040a)' }] },
  },
}

export default meta
type Story = StoryObj<typeof PanelHeader>

export const Default: Story = {
  render: () => (
    <PanelCard className="w-80">
      <PanelHeader title="Focus Timer" />
      <p className="text-sm text-secondary">Panel body content.</p>
    </PanelCard>
  ),
}

export const WithAction: Story = {
  render: () => (
    <PanelCard className="w-80">
      <PanelHeader
        title="Study tasks"
        action={
          <button type="button" className="text-micro font-bold text-accent-blue">
            Add
          </button>
        }
      />
      <p className="text-sm text-secondary">Panel body content.</p>
    </PanelCard>
  ),
}

export const Borderless: Story = {
  render: () => (
    <PanelCard className="w-80">
      <PanelHeader title="Mood distribution" bordered={false} />
      <p className="text-sm text-secondary">Chart area placeholder.</p>
    </PanelCard>
  ),
}
