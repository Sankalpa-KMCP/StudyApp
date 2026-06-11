import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConfirmProvider } from '../context/ConfirmProvider'
import { ControlDeck } from './ControlDeck'

const meta: Meta<typeof ControlDeck> = {
  title: 'Features/ControlDeck',
  component: ControlDeck,
  decorators: [
    Story => (
      <ConfirmProvider>
        <div className="max-w-6xl p-6 min-h-screen" style={{ background: '#0d0a1b' }}>
          <p className="text-white/60 text-sm mb-4">
            Control Deck requires Study App providers — open the Settings tab in the running app for the full experience.
          </p>
          <Story />
        </div>
      </ConfirmProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ControlDeck>

export const Default: Story = {
  render: () => <ControlDeck />,
}
