import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card } from './Card'

const meta: Meta<typeof Card> = {
  title: 'Shared/Card',
  component: Card,
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <div className="max-w-sm p-6" style={{ background: '#0a0b10' }}>
      <Card>
        <p className="text-sm text-white">Default glass card with theme-aware opacity.</p>
      </Card>
    </div>
  ),
}

export const Elevated: Story = {
  render: () => (
    <div className="max-w-sm p-6" style={{ background: '#0a0b10' }}>
      <Card variant="elevated" padding="lg">
        <p className="text-sm text-white">Elevated variant for metric panels.</p>
      </Card>
    </div>
  ),
}
