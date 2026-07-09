import type { Meta, StoryObj } from '@storybook/react-vite'
import { MobileTabBar } from './MobileTabBar'

const meta: Meta<typeof MobileTabBar> = {
  title: 'Navigation/MobileTabBar',
  component: MobileTabBar,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof MobileTabBar>

export const FocusActive: Story = {
  args: {
    activeTab: 'focus',
    setActiveTab: () => {},
    isTimerActive: false,
    timerMode: 'study',
    enforceLockout: false,
  },
  decorators: [
    Story => (
      <div className="min-h-screen bg-[#0a0b10] pb-24">
        <Story />
      </div>
    ),
  ],
}
