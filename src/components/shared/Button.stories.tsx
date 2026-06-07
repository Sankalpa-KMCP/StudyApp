import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'Shared/Button',
  component: Button,
}

export default meta
type Story = StoryObj<typeof Button>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 p-6 rounded-2xl" style={{ background: '#0a0b10' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3 p-6 rounded-2xl" style={{ background: '#0a0b10' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
    </div>
  ),
}
