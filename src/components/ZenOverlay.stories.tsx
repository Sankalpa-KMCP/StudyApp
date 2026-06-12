import type { Meta, StoryObj } from '@storybook/react-vite'
import { ZenOverlay } from './ZenOverlay'

const meta: Meta<typeof ZenOverlay> = {
  title: 'Features/ZenOverlay',
  component: ZenOverlay,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ZenOverlay>

export const Active: Story = {
  args: {
    isZenMode: true,
    canvasRef: { current: null },
    remainingSeconds: 900,
    timerMode: 'study',
    sessionTasks: [{ id: 1, text: 'Deep work', completed: false, createdAt: Date.now(), estimatedCycles: 2, actualCycles: 0 }],
    activeTaskId: 1,
    isTimerActive: true,
    setIsTimerActive: () => {},
    completeSession: () => {},
    enforceLockout: false,
    setIsZenMode: () => {},
    pageGradient: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 48%, #020617 100%)',
  },
}
