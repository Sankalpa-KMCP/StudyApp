import type { Meta, StoryObj } from '@storybook/react-vite'
import { FocusSanctuary } from './FocusSanctuary'
import { StudyAppProvider } from '../context/StudyAppProvider'

const meta: Meta<typeof FocusSanctuary> = {
  title: 'Focus/FocusSanctuary',
  component: FocusSanctuary,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <StudyAppProvider>
        <div className="w-full max-w-md p-4">
          <Story />
        </div>
      </StudyAppProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof FocusSanctuary>

export const Idle: Story = {
  args: {
    setIsZenMode: () => {},
    onUserGesture: () => {},
  },
}
