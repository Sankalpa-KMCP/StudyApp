import type { Meta, StoryObj } from '@storybook/react'
import { TabPageShell, TabSection } from './TabPageShell'
import { PanelCard } from './PanelCard'

const meta: Meta<typeof TabPageShell> = {
  component: TabPageShell,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'theme', values: [{ name: 'theme', value: 'var(--body-base, #05040a)' }] },
  },
}

export default meta
type Story = StoryObj<typeof TabPageShell>

export const TwoColumn: Story = {
  render: () => (
    <TabPageShell>
      <TabSection label="Left">
        <PanelCard>Primary column content</PanelCard>
      </TabSection>
      <TabSection label="Right" className="lg:col-span-7">
        <PanelCard>Secondary column content</PanelCard>
      </TabSection>
    </TabPageShell>
  ),
}
